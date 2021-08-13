import {VRButton} from '../three.js/examples/jsm/webxr/VRButton.js';
import {OrbitControls} from '../three.js/examples/jsm/controls/OrbitControls.js';

export {DOMRenderer, VRRenderer, vrBoard};


// Event listeners.
function onSessionStart(event) {

    // Set the enabled flag here because it's used to avoid executing code that
    // has no effect when not in VR mode.
    const xr = event.target;
    const starRenderer = xr.starRenderer;
    xr.enabled = true;
};
function onSessionEnd(event) {
    
    const xr = event.target;
    const starRenderer = xr.starRenderer;
    xr.enabled = false;
};


// StarRenderer
//
class StarRenderer {
    constructor(starScene) {

        this.starScene = starScene;
        this.starMap = starScene.starMap;
        this.renderer = new THREE.WebGLRenderer( {antialias:true} );
        
        // Camera position and direction can be passed as parameters, which are
        // held in the star map.  The default values are
        //     position:  {x: 0, y: 0, z: observerDistance}
        //     direction: {x: 0, y: 0, z: -1}
        //
        let initialPosition = {x: 0, y: 0, z: this.starScene.observerDistance};
        if (this.starMap.sceneParams.position) {
            initialPosition = this.starMap.sceneParams.position;
        };

        // The specifications pertaining to the camera are determined from the
        // scale and character of the scene, which are properties of the star
        // scene.
        const cameraSpecs = this.starScene.cameraSpecs();
        this.initCamera(cameraSpecs, initialPosition);

        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputEncouding = THREE.sRGBEncoding;
    };

    createCanvas() {

        console.warn("The method createCanvas() was called from the supper class.");
        return;
    };

    update() {
        
        this.onBeginUpdate();
        
        if (this.starScene.animation === 'movie') {

            // If the spaceship is moving through the scene, advance the camera
            // position.
            this.advanceCamera();
        };
        
        this.onEndUpdate();
    };
    onBeginUpdate() {
        return;
    };
    onEndUpdate() {
        return;
    };
    
    renderOnce() {
       this.renderer.render(this.starScene.scene, this.camera);
    };
   
    // The movie direction.
    setMovieDirection() {
        
        // Calculate the unit vector that points in the direction the camera is
        // looking.
        const p = new THREE.Vector3();
        this.camera.getWorldDirection(p);
        this.movieDirection = p;
    };
    getMovieDirection() {

        if (!this.movieDirection) {
            this.setMovieDirection();
        };
        return this.movieDirection;
    };
    
    advanceCamera() {

        // This code will make movieDirection a vector pointing in the direction
        // of the camera's motion, with a length  equal to the distance to the
        // origin divided by 60*24.
        const pm = new THREE.Vector3().copy(this.getMovieDirection());
        pm.multiplyScalar(this.starScene.movieStep);
        
        let p = new THREE.Vector3();
        p.copy(this.spaceship.position);

        // Move the camera one MOVIE_STEP.
        p = p.add(pm);
        this.spaceship.position.copy(p);
    };
    
    // Calculate the direction of the gaze in spherical coordinates, the
    // equator at zero degrees.  However, in the VR world, the y-axis is the
    // polar axis, so...
    //    x = cos(phi) cos(theta)
    //    z = sin(phi) cos(theta)
    //    y = sin(theta)
    directionToSpherical(n) {
        
        let azimuth, longitude;
        
        azimuth = Math.asin(n.y);
        if (n.z < 0) {
            longitude = 2*Math.PI - Math.acos( -n.x/Math.sqrt(n.x*n.x + n.z*n.z) );
        }
        else {
            longitude = Math.acos( -n.x/Math.sqrt(n.x*n.x + n.z*n.z) );
        };
        
        // Degrees are more understandable to humans.
        return {
            azimuth: azimuth*180/Math.PI, longitude: longitude*180/Math.PI
        };
    };
};


// The WebGL render on a DOM element in the web page HTML.
//
class DOMRenderer extends StarRenderer {
    
    constructor(starScene) {
        
        super(starScene);
//        this.renderer.setSize(window.innerWidth, window.innerHeight)
        this.renderer.setSize(
                this.starMap.sceneParams.width,
                this.starMap.sceneParams.height
        );

        // the orbit controls are advertised to rotate the camera about the
        // scene.  This is done by rotating the scene along with the coordinates
        // of the scene (Are these world coordindates?) in the opposite
        // direction.
        //
        // The orbit controls act on the spaceship, and therefor the camera-
        // spaceship assembly.
        this.orbitControls =
            new OrbitControls(this.spaceship, this.renderer.domElement);
        this.orbitControls.enableZoom = true;
        this.orbitControls.enablePan = false;
        
//        this.canvas = this.createCanvas();
//        this.setMovieDirection();
    };
    
    initCamera(cameraSpecs, initialPosition) {

        // Camera
        // 
        // The next section creates the camera and the spaceship.  The spaceship
        // can move; the camera is firmly affixed to the spaceship's nose.  The
        // spaceship is a dimensionless object, and as sspaceshipuch, has no
        // orientation.  For this reason, the camera and spaceship are
        // positioned by means of a translation instead of setting the position
        // property.  The latter approach can introduce an unwanted rotation.
        // 
        // The near plane of the camera is always 6 inches away because that's
        // the closest an object can be and still be comfortable (for a young
        // person) to look at.
        this.camera = new THREE.PerspectiveCamera(
                cameraSpecs.fov,
                window.innerWidth/window.innerHeight,
                cameraSpecs.near,
                cameraSpecs.far);
        this.camera.name = 'DOM camera';

        // Spaceship
        // 
        // THREE doesn't recognize this rig as a perspective camera, so it
        // disables both zoom and pan.  The pan feature is dispensible, but the
        // zoom is very useful.  This trick works for zoom, but not pan.  The
        // pan feature is disabled for the oribit controls (later in this
        // function).
        //
        // The spaceship is created at the origin.  It's world direction is
        // [0,0,1] and up is [0,1,0].
        this.spaceship = new THREE.Object3D();
        this.spaceship.name = 'spaceship';
        this.spaceship.isPerspectiveCamera = true;
    
        // To assemble the camera-spaceship rig, we must rotate the camera to
        // face the same direction as the spaceship.  Then attach
        // ( spaceship.add() ) the camera to the spaceship.  Finally, the
        // assembly is rotated again so that both camera and spaceship are
        // facing [0,0,-1], which is the expected world direction for a camera.
        this.camera.rotateY(Math.PI);
        this.spaceship.add(this.camera);
        this.spaceship.rotateY(Math.PI);

        // By default, the camera and spaceship are located on the positive
        // z-axis.  This is so that the mouse controls the rotations of the
        // scene as expected ...
        //     x-axis is radial from the GC out.
        //     y-axis is towards the north galactic pole.
        //     z-axis is galactic east from the position of the sun.
        this.spaceship.position.set(
                initialPosition.x,
                initialPosition.y,
                initialPosition.z
        );
        this.starScene.scene.add(this.spaceship);
    };
    
    canvasON() {

        // The renderer, which must be a child DOM element of the canvas on which
        // the stars are displayed.
        //
        this.starMap.canvas.appendChild(this.renderer.domElement);
    };
    canvasOFF() {
        if (this.starMap.canvas.contains(this.renderer.domElement)) {
            this.starMap.canvas.removeChild(this.renderer.domElement);
        };
    };
    
    // The DOM renderer just needs to update the orbit controls.
    onEndUpdate() {
        this.orbitControls.update();
    };
};


// VRRenderer
//
class VRRenderer extends StarRenderer {
    
    constructor(starScene) {
        
        // TODO: Check the WebXR is supported.
        super(starScene);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // This conroller is a ray emminating along the user's point-of-view.
        // stars that are near this ray are selected and information about that
        // star, if available, is displayed to the user in the VR experience.
        this.controller = this.renderer.xr.getController(0);
        this.controller.starRenderer = this;
        this.controller.addEventListener('connected', function (event) {

            this.add(vrBoard.vrMessageBoard);
        });
        this.spaceship.add(this.controller);
        this.controller.addEventListener('selectstart', function(event) {
            
            if (this.starRenderer.starScene.animation === 'animate') {
                this.starRenderer.setMovieDirection();
                this.starRenderer.starScene.animation = 'movie';
            }
            else {
                this.starRenderer.starScene.animation = 'animate';
            };
        });
        
        // This intersects stars so we can display information on the star the
        // user is looking at.
        this.raycaster = new THREE.Raycaster();
        
        // The field of stars that can be selected should me limited.  The near
        // cutoff is the near field of the camera.  The far cutoff is 200% of
        // the scene radius.
        const cameraSpecs = this.starScene.cameraSpecs()
        this.raycaster.near = cameraSpecs.near;
        this.raycaster.far = 2.0*this.starScene.sceneRadius;
        
        // The bubble around the star that the ray intersects to select the star
        // is 5 cm in the TABLE scale (scene radius is 1.0 m).  The threshold is
        // this radius scaled according to the character.
        const threshold = 0.05*this.starScene.sceneRadius;
        this.raycaster.params = {Points: {threshold: threshold}};
        
        // Event listeners.
        this.renderer.xr.addEventListener('sessionstart', onSessionStart);
        this.renderer.xr.addEventListener('sessionend', onSessionEnd);

        this.renderer.setPixelRatio(0.20*window.devicePixelRatio);
        this.renderer.xr.setReferenceSpaceType('local');
        
        // The canvas DOM element.  This is added and removed.
        this.canvas = document.createElement('div');
    };
    
    initCamera(cameraSpecs, initialPosition) {

        this.camera = new THREE.PerspectiveCamera(
                cameraSpecs.fov,
                window.innerWidth/window.innerHeight,
                cameraSpecs.near,
                cameraSpecs.far);
        this.camera.name = 'VR camera';

        // Create a dolly.  It must have the isPerspectiveCamera property for
        // the orbit controls zoom feature to work.
        this.spaceship = new THREE.Group();
        this.spaceship.add(this.camera);
        this.spaceship.position.set(
                initialPosition.x,
                initialPosition.y,
                initialPosition.z
        );
        this.starScene.scene.add(this.spaceship);
    };
    
    canvasON() {
        document.body.appendChild(this.canvas);
        document.body.appendChild(VRButton.createButton(this.renderer));
    };
    canvasOFF() {
        if (document.body.contains(this.canvas)) {
            document.body.removeChild(this.canvas);
            
            // And remove the Enter VR button.
            const button = document.getElementById('VRButton');
            document.body.removeChild(button);
        };
    };
    
    onBeginUpdate() {

        // Find the intersects if we have stars in the starScene and we are in
        // VR mode.
        if (this.starScene.starCloud.starCloudIndex && this.renderer.xr.enabled) {
            const intersect = findIntersect(
                    this.raycaster, this.camera, this.starScene);
                
            // Highlight the star.
            this.starScene.highlightStar(intersect.index);
                
            // Update the message board with the star's attribute.
            vrBoard.msg(intersect.msg);
        };
    };
    onEndUpdate() {
        
        // Update the message board.
        ThreeMeshUI.update();
    };
};

class VRMessageBoard {
    constructor() {
        
        // Writing printfs to this message board is the only way to debug
        // aspects of the VR that are not supported in the chrome WebXR
        // simulartor.
        this.displayMessage = true;
        
        // Create the message board and the raycaster now so that they're
        // permanent.  But the need to be attached to the VR camera to work in the
        // VR.  That will be initiated from the WebXRManager.
        this.vrMessageText = new ThreeMeshUI.Text({content: "Write some text."});
        this.vrMessageText.name = 'message';

        if (this.displayMessage) {

            this.vrMessageBoard = new ThreeMeshUI.Block({
                width: 0.400,
                height: 0.050,
                justifyContent: 'center',
                padding: 0.010,
                fontFamily: '/three-mesh-ui/examples/assets/Roboto-msdf.json',
                fontTexture: '/three-mesh-ui/examples/assets/Roboto-msdf.png',
                fontSize: 0.025,
                fontColor: new THREE.Color(0x7f7f7f),
                backgroundOpacity: 0.2
            }).add(this.vrMessageText);
            this.vrMessageBoard.name = 'message board';
//            this.vrMessageBoard.visible = false;
            this.vrMessageBoard.visible = true;  // Let's try this for a while.
            this.vrMessageBoard.position.set(0, -0.07, -0.40);
        }
        else {
            this.vrMessageBoard = new ThreeMeshUI.Block({
                width: 0.300,
                height: 0.050,
                justifyContent: 'center',
                padding: 0.010,
                fontFamily: '/three-mesh-ui/examples/assets/Roboto-msdf.json',
                fontTexture: '/three-mesh-ui/examples/assets/Roboto-msdf.png',
                fontSize: 0.030,
                fontColor: new THREE.Color(0x7f7f7f),
                backgroundOpacity: 0.3
            }).add(this.vrMessageText);
            this.vrMessageBoard.name = 'message board';
            this.vrMessageBoard.visible = true;
            this.vrMessageBoard.position.set(0, -0.1, -0.5);
        };
        
        let geometry, material;
        geometry = new THREE.RingGeometry( 0.08, 0.12, 32 ).translate( 0, 0.10, -10 );
        material = new THREE.MeshBasicMaterial( { opacity: 0.1, transparent: true, attenuation: false } );
        this.vrMessageBoard.add(new THREE.Mesh( geometry, material ));
    };
    
    msg(msg) {
        
        if (this.displayMessage) {
            if (msg === " ") {
                this.vrMessageText.set({content: msg});
    //            this.vrMessageBoard.visible = false;
            }
            else {
                this.vrMessageText.set({content: msg});
    //            this.vrMessageBoard.visible = true;
            };
        };
    };
    error(errorMessage) {
        this.vrMessageText.set({content: errorMessage});
    };
    
    show() {
        this.vrMessageBoard.visible = true;
    };
    
    hide() {
        this.vrMessageBoard.visible = false;
    };
};
const vrBoard = new VRMessageBoard();


// findIntersect()
//
// Finds the star that is closest to the line of sight, within a threshold of
// approximately 0.20 radians.  Returns null if no star is within the threshold.
//
function findIntersect(raycaster, controller, starScene) {
    
    // This makes it easier to read and easier to debug.
    // 
    // Consider getters on starScene, so things can move around there without
    // breaking code elsewhere.
    const starCloudIndex = starScene.starCloud.starCloudIndex;
    const starLookup = starScene.starCloud.starLookup;
    const stars = starScene.starCloud.stars;
    const tempMatrix = new THREE.Matrix4();

    tempMatrix.identity().extractRotation( controller.matrixWorld );
    raycaster.ray.origin.setFromMatrixPosition( controller.matrixWorld );
    raycaster.ray.direction.set( 0, 0, -1 ).applyMatrix4( tempMatrix );
    
    // The closest object is the first in the array.
    const intersects = raycaster.intersectObject(starCloudIndex);
    if (intersects.length === 0) {
        return {index: null, msg: " "}
    };

    let theta, curTheta;
    let idx = -1;              // 0 is a legitimate index. 
   theta = Math.PI/60.0;       // 3 degrees.
    for (let i = 0; i < intersects.length; i++) {

        // Compute the angular separation.
        const y = intersects[i].distanceToRay;
        const x = intersects[i].distance;
        curTheta = Math.abs(Math.atan(y/x));
        if (curTheta < theta) {
            theta = curTheta;
            idx = intersects[i].index;
        };
    };
    
    if (idx < 0) {
        
        // Selected star is too far from the line of site.
        return {index: null, msg: " "};
    }
    else {
        
        // A star has been found.
        const starIdx = starLookup[idx];
        const selectedStar = stars[starIdx];
        return {index: starIdx, msg: selectedStar.info()};
    };
};
