const { enable3d, Scene3D, Canvas, ThirdDimension, ExtendedObject3D, THREE, JoyStick, ThirdPersonControls, PointerLock, PointerDrag } = ENABLE3D

/**
 * Is touch device?
 */
const isTouchDevice = 'ontouchstart' in window

class MainScene extends Scene3D {
  constructor() {
    super({ key: 'MainScene' })
  }

  init() {
    this.accessThirdDimension({ maxSubSteps: 10, fixedTimeStep: 1 / 120 })

    this.third.renderer.setSize(WIDTH, HEIGHT)
    this.third.camera.aspect = WIDTH / HEIGHT
    this.third.camera.updateProjectionMatrix()

    this.third.renderer.setPixelRatio(Math.max(1, window.devicePixelRatio / 2))

    this.canJump = true
    this.move = false

    this.moveTop = 0
    this.moveRight = 0
  }

  create() {
    this.third.warpSpeed('-ground', '-orbitControls')
    this.third.renderer.gammaFactor = 1.5

    // this.third.physics.debug.enable()

    /**
     * Medieval Fantasy Book by Pixel (https://sketchfab.com/stefan.lengyel1)
     * https://sketchfab.com/3d-models/medieval-fantasy-book-06d5a80a04fc4c5ab552759e9a97d91a
     * Attribution 4.0 International (CC BY 4.0)
     */
    this.third.load.gltf('/assets/glb/book.glb').then(object => {
      const scene = object.scenes[0]

      const book = new ExtendedObject3D()
      book.name = 'scene'
      book.add(scene)
      this.third.add.existing(book)

      // add animations
      // sadly only the flags animations works
      object.animations.forEach((anim, i) => {
        book.mixer = this.third.animationMixers.create(book)
        // overwrite the action to be an array of actions
        book.action = []
        book.action[i] = book.mixer.clipAction(anim)
        book.action[i].play()
      })

      book.traverse(child => {
        if (child.isMesh) {
          child.castShadow = child.receiveShadow = true
          child.material.metalness = 0
          child.material.roughness = 1

          if (/mesh/i.test(child.name)) {
            child.shape = 'concave'
            // I do not know why the physics has an offset but I just fixed it manually
            child.position.set(-18.8, 4.35, -15.55)
            this.third.physics.add.existing(child, {
              autoCenter: false,
              collisionFlags: 1,
              offset: { x: 18.8, y: -4.35, z: 15.55 }
            })
            child.body.setAngularFactor(0, 0, 0)
            child.body.setLinearFactor(0, 0, 0)
          }
        }
      })
    })

    /**
     * box_man.glb by Jan Bláha
     * https://github.com/swift502/Sketchbook
     * CC-0 license 2018
     */
    this.third.load.gltf('/assets/glb/box_man.glb').then(object => {
      const man = object.scene.children[0]

      this.man = new ExtendedObject3D()
      this.man.name = 'man'
      this.man.rotateY(Math.PI + 0.1) // a hack
      this.man.add(man)
      this.man.rotation.set(0, Math.PI * 1.5, 0)
      this.man.position.set(35, -3.5, 0)
      // add shadow
      this.man.traverse(child => {
        if (child.isMesh) {
          child.castShadow = child.receiveShadow = true
          // https://discourse.threejs.org/t/cant-export-material-from-blender-gltf/12258
          child.material.roughness = 1
          child.material.metalness = 0
        }
      })

      /**
       * Animations
       */
      this.man.mixer = this.third.animationMixers.create(this.man)
      object.animations.forEach(animation => {
        if (animation.name) {
          this.man.anims[animation.name] = animation
        }
      })
      this.man.setAction('idle')

      /**
       * Add the player to the scene with a body
       */
      this.third.add.existing(this.man)
      this.third.physics.add.existing(this.man, {
        shape: 'sphere',
        radius: 0.25,
        width: 0.5,
        offset: { y: -0.25 }
      })
      this.man.body.setFriction(0.8)
      this.man.body.setAngularFactor(0, 0, 0)

      // https://docs.panda3d.org/1.10/python/programming/physics/bullet/ccd
      this.man.body.setCcdMotionThreshold(1e-7)
      this.man.body.setCcdSweptSphereRadius(0.25)

      /**
       * Add 3rd Person Controls
       */
      this.controls = new ThirdPersonControls(this.third.camera, this.man, {
        offset: new THREE.Vector3(0, 1, 0),
        targetRadius: 3
      })
      // set initial view to 90 deg theta
      this.controls.theta = 90

      /**
       * Add Pointer Lock and Pointer Drag
       */
      if (!isTouchDevice) {
        let pl = new PointerLock(this.game.canvas)
        let pd = new PointerDrag(this.game.canvas)
        pd.onMove(delta => {
          if (pl.isLocked()) {
            this.moveTop = -delta.y
            this.moveRight = delta.x
          }
        })
      }
    })

    /**
     * Add Keys
     */
    this.keys = {
      a: this.input.keyboard.addKey('a'),
      w: this.input.keyboard.addKey('w'),
      d: this.input.keyboard.addKey('d'),
      s: this.input.keyboard.addKey('s'),
      space: this.input.keyboard.addKey(32)
    }

    /**
     * Add joystick
     */
    if (isTouchDevice) {
      const joystick = new JoyStick()
      const axis = joystick.add.axis({
        styles: { left: 35, bottom: 35, size: 100 }
      })
      axis.onMove(event => {
        /**
         * Update Camera
         */
        const { top, right } = event
        this.moveTop = top
        this.moveRight = right
      })
      const buttonA = joystick.add.button({
        letter: 'A',
        styles: { right: 35, bottom: 110, size: 80 }
      })
      buttonA.onClick(() => this.jump())
      const buttonB = joystick.add.button({
        letter: 'B',
        styles: { right: 110, bottom: 35, size: 80 }
      })
      buttonB.onClick(() => (this.move = true))
      buttonB.onRelease(() => (this.move = false))
    }

    setTimeout(() => {
      const placeholder = document.getElementById('welcome-game-placeholder')
      if (placeholder) placeholder.remove()
    }, 500)
  }

  jump() {
    if (!this.man || !this.canJump) return
    this.canJump = false
    this.man.setAction('jump_running')
    this.time.addEvent({
      delay: 750,
      callback: () => {
        this.canJump = true
        this.man.setAction('idle')
      }
    })
    this.man.body.applyForceY(6)
  }

  update(time, delta) {
    if (this.man && this.man.body) {
      /**
       * Update Controls
       */
      this.controls.update(this.moveRight * 3, -this.moveTop * 3)
      if (!isTouchDevice) this.moveRight = this.moveTop = 0
      /**
       * Player Turn
       */
      const speed = 4
      const v3 = new THREE.Vector3()

      const rotation = this.third.camera.getWorldDirection(v3)
      const theta = Math.atan2(rotation.x, rotation.z)
      const rotationMan = this.man.getWorldDirection(v3)
      const thetaMan = Math.atan2(rotationMan.x, rotationMan.z)
      this.man.body.setAngularVelocityY(0)

      const l = Math.abs(theta - thetaMan)
      let rotationSpeed = isTouchDevice ? 2 : 4
      let d = Math.PI / 24

      if (l > d) {
        if (l > Math.PI - d) rotationSpeed *= -1
        if (theta < thetaMan) rotationSpeed *= -1
        this.man.body.setAngularVelocityY(rotationSpeed)
      }

      /**
       * Player Move
       */
      if (this.keys.w.isDown || this.move) {
        if (this.man.currentAnimation === 'idle' && this.canJump) this.man.setAction('run')

        const x = Math.sin(theta) * speed,
          y = this.man.body.velocity.y,
          z = Math.cos(theta) * speed

        this.man.body.setVelocity(x, y, z)
      } else {
        if (this.man.currentAnimation === 'run' && this.canJump) this.man.setAction('idle')
      }

      /**
       * Player Jump
       */
      if (this.keys.space.isDown && this.canJump) {
        this.jump()
      }
    }
  }
}

const config = {
  type: Phaser.WEBGL,
  scale: {
    mode: Phaser.Scale.FIT,
    width: WIDTH,
    height: HEIGHT
  },
  scene: [MainScene],
  ...Canvas({ antialias: false })
}

window.addEventListener('load', () => {
  enable3d(() => new Phaser.Game(config)).withPhysics('/lib')

  const destination = document.getElementById('welcome-game')
  const source = document.getElementById('myCustomCanvas')
  destination.appendChild(source)

  source.style.marginTop = '0px !important'

  window.onresize = ev => {
    const newWidth = window.innerWidth
    const newHeight = (HEIGHT / WIDTH) * newWidth
    destination.style.width = `${newWidth}px`
    destination.style.height = `${newHeight}px`
  }
})
