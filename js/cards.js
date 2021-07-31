// This examples is hard
// To understand it, you have to carefully read all readme`s and other examples of respective plugins
// Be ready to study the plugins code. Please use latest version of those libs
// Used plugins: pixi-projection, pixi-display

let width = (window.innerWidth > 0) ? window.innerWidth - 1 : screen.width - 1
let height = (window.innerHeight > 0) ? window.innerHeight - 1 : screen.height - 1
let scaleX = 1
let scaleY = 1
if(width<720){
    scaleX =  width/720
    scaleY =  width/720
}

const app = new PIXI.Application({ width: width, height: height, autoStart: false, antialias: true, backgroundColor: 0x20cd65 })
document.body.appendChild(app.view)
app.stage = new PIXI.display.Stage()

const { loader } = app


const camera = new PIXI.projection.Camera3d()
camera.position.set(app.screen.width / 2, app.screen.height/ 2+80*scaleY )
camera.setPlanes(350*scaleX, 30*scaleY, 10000)
camera.euler.x = 0
app.stage.addChild(camera)

const cards = new PIXI.projection.Container3d()
cards.position3d.y = 50 * scaleY
// MAKE CARDS LARGER:
cards.scale3d.set(1.5)
camera.addChild(cards)

const shadowGroup = new PIXI.display.Group(1)
const cardsGroup = new PIXI.display.Group(2, ((item) => {
    item.zOrder = -item.getDepth()
    item.parent.checkFace()
}))

// Layers are 2d elements but we use them only to show stuff, not to transform items, so its fine :)
camera.addChild(new PIXI.display.Layer(shadowGroup))
camera.addChild(new PIXI.display.Layer(cardsGroup))
// we could also add layers in the stage, but then we'll need extra layer for the text

// load assets
loader.add('cards', 'img/cards.json')
loader.add('table', 'img/table.png')
loader.load(onAssetsLoaded)

// blur for shadow. Do not use it in production, bake shadow into the texture!
const blurFilter = new PIXI.filters.BlurFilter()
blurFilter.blur = 0.2

class CardSprite extends PIXI.projection.Container3d {
    constructor() {
        super()

        const tex = loader.resources.cards.textures

        // shadow will be under card
        this.shadow = new PIXI.projection.Sprite3d(tex['black.png'])
        this.shadow.anchor.set(0.5)
        this.shadow.scale3d.set(0.98*scaleX)
        this.shadow.alpha = 0.7
        // TRY IT WITH FILTER:
        this.shadow.filters = [blurFilter]
        // all shadows are UNDER all cards
        this.shadow.parentGroup = cardsGroup
        this.inner = new PIXI.projection.Container3d()
        // cards are above the shadows
        // either they have back, either face
        this.inner.parentGroup = cardsGroup
        this.addChild(this.shadow)
        this.addChild(this.inner)

        // construct "inner" from back and face
        this.back = new PIXI.projection.Sprite3d(tex['cover1.png'])
        this.back.anchor.set(0.5)
        this.back.scale3d.set(scaleX)
        this.face = new PIXI.projection.Container3d()
        this.face.scale3d.set(scaleX)
        this.inner.addChild(this.back)
        this.inner.addChild(this.face)
        this.code = 0
        this.showCode = -1
        this.inner.euler.y = Math.PI
        this.scale3d.set(0.2)

        // construct "face" from four sprites
        this.createFace()
    }

    createFace() {
        const { face } = this
        face.removeChildren()
        const tex = loader.resources.cards.textures
        const sprite = new PIXI.projection.Sprite3d(tex['white1.png'])
        const sprite2 = new PIXI.projection.Sprite3d(PIXI.Texture.EMPTY)
        const sprite3 = new PIXI.projection.Sprite3d(PIXI.Texture.EMPTY)
        const sprite4 = new PIXI.projection.Sprite3d(PIXI.Texture.EMPTY)
        sprite2.y = -120 
        sprite2.x = -80 
        sprite3.y = 70 
        sprite3.x = 40 
        sprite4.y = -70
        sprite4.x = -100

        sprite.anchor.set(0.5)
        sprite2.anchor.set(0.5)
        sprite3.anchor.set(0.5)
        face.addChild(sprite)
        face.addChild(sprite2)
        face.addChild(sprite3)
        face.addChild(sprite4)
    }

    updateFace() {
        const tex = loader.resources.cards.textures
        const code = this.showCode === -1 ? 0 : this.showCode
        const num = code & 0xf
        const suit = code >> 4

        const { face } = this
        face.children[1].texture = num > 0 ? tex[`${suit % 2}_${num}.png`] : PIXI.Texture.EMPTY
        if (!face.children[1].texture) {
            console.log('FAIL 1 ', `${suit % 2}_${num}.png`)
        }
        face.children[2].texture = suit !== 0 ? tex[`${suit}_big.png`] : PIXI.Texture.EMPTY
        if (!face.children[2].texture) {
            console.log('FAIL 2', `${suit}_big.png`)
        }
        face.children[3].texture = suit !== 0 ? tex[`${suit}_small.png`] : PIXI.Texture.EMPTY
        if (!face.children[3].texture) {
            console.log('FAIL 3', `${suit}_small.png`)
        }
    }

    update(dt) {
        const { inner } = this
        if (this.show && inner.euler.y > 0) {
            inner.euler.y = Math.max(0, inner.euler.y - dt * 5)
        }
        if (!this.show && inner.euler.y < Math.PI) {
            inner.euler.y = Math.min(Math.PI, inner.euler.y + dt * 5)
        }
        inner.position3d.z = -Math.sin(inner.euler.y) * this.back.width * scaleY
        // assignment is overriden, so its actually calling euler.copyFrom(this.euler)
        this.shadow.euler = inner.euler
        if (this.show && inner.euler.y == 0) {
            checkLogic(this)
        }
    }

    checkFace() {
        const { inner } = this
        let cc

        if (!inner.isFrontFace()) {
            // user sees the back
            cc = 0
        } else {
            cc = 0
            if (this.show) {
                cc = this.code
            }
        }
        if (cc === 0) {
            this.back.renderable = true
            this.face.renderable = false
        } else {
            this.back.renderable = false
            this.face.renderable = true
        }

        if (cc !== this.showCode) {
            this.showCode = cc
            this.updateFace()
        }
    }
}

let runCards = []
let sideCards = []
let handCards = []
let handIndex = 0
let sideCardIndex = 0
let currentCard = null
let gameOver = false

function dealHand() {
    runCards = []
    sideCards = []
    handCards = []
    handIndex = 0
    sideCardIndex = 0
    currentCard = null
    cards.removeChildren()
    for (let i = 0; i < 5; i++) {
        let x = 56 * 2 * scaleX
        let y = -80 * (i - 1) * scaleY
        let card = newCard(x, y, nextCardCode(), false)
        card.typeGroup = 'side'
        sideCards.push(card)
    }
    for (let i = 1; i <= 4; i++) {
        let x = 56 * (i - 3) * scaleX
        let y = 80 * scaleY
        let card = newCard(x, y, cardCode(i, 14), true)
        card.typeGroup = 'run'
        onClick({ target: card })
        runCards.push(card)
    }
    for (let i = 0; i < cardCodes.length - cardCodeIndex; i++) {
        let x = 56 * 3 * scaleX
        let y = (60 + i) * scaleY
        let card = newCard(x, y, nextCardCode(), false)
        card.typeGroup = 'hand'
        card.on('mouseup', run)
        card.on('touchend', run)
        handCards.push(card)
    }
}

function newCard(x, y, code) {
    const card = new CardSprite()
    card.show = false
    card.logicChecked = false
    card.rank = 0
    card.position3d.x = x
    card.position3d.y = y
    card.update(0)
    card.interactive = true
    card.realCode = code
    cards.addChild(card)
    return card
}

let cardCodes = []
let cardCodeIndex = 0

function generateAllCards() {
    cardCodes = []
    cardCodeIndex = 0
    for (let suit = 1; suit <= 4; suit++) {
        for (let num = 2; num <= 13; num++) {
            cardCodes.push(cardCode(suit, num))
        }
    }
    cardCodes = shuffle(cardCodes)
}

function nextCardCode() {
    return cardCodes[++cardCodeIndex]
}

function shuffle(arr) {
    var i,
        j,
        temp;
    for (i = arr.length - 1; i > 0; i--) {
        j = Math.floor(Math.random() * (i + 1));
        temp = arr[i];
        arr[i] = arr[j];
        arr[j] = temp;
    }
    return arr;
}

function randNum() {
    return (Math.random() * 13 | 0) + 2
}

function randSuit() {
    return (Math.random() * 4 | 0) + 1
}

function cardCode(suit, num) {
    return suit * 16 + num
}

function onClick(event) {
    const { target } = event
    if (!target.show) {
        target.show = true
        target.code = target.realCode
    }
}

function checkLogic(card) {
    const code = card.showCode === -1 ? 0 : card.showCode
    const num = code & 0xf
    const suit = code >> 4
    let { inner } = card
    if (inner.euler.y == 0 && !card.logicChecked) {
        card.logicChecked = true
        switch (card.typeGroup) {
            case 'hand':
                let runCard = runCards[suit - 1]
                if (runCard != null) {
                    runCard.rank++
                    runCard.position3d.y -= 80 * scaleY
                    if (runCard.rank >= 5) {
                        gameOver = true
                    }
                    let openSideCard = true
                    for (let i = 0; i < runCards.length; i++) {
                        let runCard = runCards[i]
                        if (runCard.rank <= sideCardIndex) {
                            openSideCard = false
                        }
                    }
                    if (openSideCard) {
                        onClick({ target: sideCards[sideCardIndex++] })
                    }
                }
                break;
            case 'side':
                let runCard2 = runCards[suit - 1]
                if (runCard2 != null) {
                    runCard2.rank--
                    runCard2.position3d.y += 80 * scaleY
                }
                break;
            case 'run':
                break;
        }
    }
}

function run() {
    if (gameOver) {
        generateAllCards()
        dealHand()
        gameOver = false
        return
    }
    if (currentCard != null) {
        currentCard.visible = false
    }
    currentCard = handCards[handCards.length - handIndex - 1]
    onClick({ target: currentCard })
    handIndex++
}



function addText(txt) {
    const style = new PIXI.TextStyle({
        fontSize: 30* scaleX,
        fontFamily: 'Arial',
        fill: 'gray',
        dropShadow: true,
        dropShadowColor: 'rgba(1, 1, 1, 0.4)',
        dropShadowDistance: -3,
        wordWrap: false,
    })
    const basicText = new PIXI.Text(txt, style)
    basicText.x = 73 * 3 * scaleX
    basicText.y = 80 * scaleY
    basicText.visible = true
    camera.addChild(basicText)
}

function onAssetsLoaded() {
    // background must be UNDER camera, it doesnt have z-index or any other bullshit for camera
    // app.stage.addChildAt(new PIXI.Sprite(loader.resources.table.texture), 0)
    generateAllCards()
    dealHand()
    addText('Click!')
    // start animating
    app.start()
}

let currentTime = new Date().getTime()

app.ticker.add((deltaTime) => {
    for (let i = 0; i < cards.children.length; i++) {
        cards.children[i].update(deltaTime / 60.0)
    }
    // let now = new Date().getTime()
    // if(now-currentTime>=2000){
    //     currentTime = now
    //     run()
    // }
    // We are gonna sort and show correct side of card,
    // so we need updateTransform BEFORE the sorting will be called.
    // otherwise this part will be tardy by one frame
    camera.updateTransform()
})
