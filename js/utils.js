/**
 * Objects and utility functions for the Orion Wordpress plugin.
 */   
// Math constants
const PI2 = Math.PI * 2;

// 3D Glasses by Rigo Peter from the Noun Project
// cardboard by mikicon from the Noun Project

// Material properties
const SIZE_ATTENUATION = false;
const TRANSPARENT = true;

// Star class constants
const DIM_STAR = 0;
const MEDIUM_STAR = 1;
const BRIGHT_STAR = 2;
const VERYDIM_STAR = 3;
const VERYBRIGHT_STAR = 4;
const MARK_RING = 5;
const LIFE_RING = 6;
const HABITABLE_RING = 7;

// Images
const STAR_IMG = 'images/disc.png';
const RING_IMG = 'images/ring.png';
const MARK_RING_RED = 'images/ring-red.png';
const MARK_RING_GREEN = 'images/ring-green.png';
const CARDBOARD_IMG = 'images/cardboard2.svg';
const GLASSES3D_IMG = 'images/glasses2.svg';

// Render engines
const CANVAS = 0;
const WEBGL = 1;

// Message states
const MSG_INFO = 0;
const MSG_NORMAL = 1;
const MSG_ERROR = 2;
const MSG_DATA_OK = 0;
const MSG_DATA_WAITING = 1;
const MSG_DATA_ERROR = 2;
const MSG_DATA_ATTRIBUTE = 3;

// SceneManager constants
const NO_ACTIVE_SCENE = -1;


//// Temporarily launch VR from here.
//function setupVRButton() {
//	var launchVRButton = document.createElement('button');
//
//	var webvr = scenes.currentScene().webvr;
//	if (webvr.webVRSupport) {
//		launchVRButton.innerHTML = 'ENTER VR';
//	}
//	else {
//		launchVRButton.innerHTML = 'WEBVR NOT SUPPORTED';
//	}
//	launchVRButton.onclick = function () {
//		webvr.activateVR();
//	};
//	document.body.appendChild(launchVRButton);
//};

// This was a very hard problem.  When a page had more than one one star map,
// the renderOnce() function would not render any of them.  The reason turned
// out to be this: the star disk image was not yet downloaded from the server
// when render was called.  The render() function would render the scene, but
// the stars were invisible, because the disk image was missing.
//
// Attempting to solve the problem with document.onLoad = ... techniques didn't
// solve the problem.  Apparently, the browser would believe the document was
// completely loaded, even though the THREE.js library was still loading
// textures.
//
// Finally, the onLoad() property of the THREE.js TexterLoader did not work
// either.  Documentation says that the onLoad function would be called when
// the image was loaded.  What happened in practice was that adding an onLoad
// parameter to the constructor just resulted in a typedef exception because
// the offset was undefined deep in the texture code in the THREE.js.
//
// The solution below seems to be the only pattern that works.
var loaderManager = new THREE.LoadingManager(
        onTextureLoad, onTextureProgress, onTextureFail
);
function onTextureLoad() {
    scenes.doWithAll(renderOnce);
};
function onTextureProgress(arg1, arg2, arg3) {};
function onTextureFail() {
    console.error("Failed to load a texture.");
};


// This utility function determines if the point is inside the rectangle.
// It's required when determining which star is under the mouse pointer.
function pointRectIntersection(p, r) {
    return p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
}


/**
  * RendererWrapper
  *
  * This object's only purpose is to retain the decision to use the WEBGL
  * or the CANVAS renderer.  The SceneManager holds the renderers.
  */
var RendererWrapper = function() {

    this.engine = CANVAS;
    if ( Detector.webgl ) {
        this.engine = WEBGL;
    }
};

RendererWrapper.prototype.newRenderer = function() {

    var renderer;
    if (WEBGL === this.engine) {
        renderer = new THREE.WebGLRenderer( {antialias:true} );
        
        // Check for OES_texture_half_float support.  Chrome on a virtualized
        // linux desktop claims to support WebGL (Detector.webgl === true), but
        // the star maps don't render.
        //
        // Thanks to yongnan on StackOverflow.  His question gave me the idea
        // for this work-around.
//        var gl = renderer.getContext();
//        if (!gl.getExtension("OES_texture_half_float")) {
//            console.warn("No OES_texture_half_float support.  Falling back to the canvas renderer.");
//            
//            delete renderer;
//            this.engine = CANVAS;
//            renderer = new THREE.CanvasRenderer(); 
//            renderer.setPixelRatio(window.devicePixelRatio);    
//        }
    } else {
        renderer = new THREE.CanvasRenderer(); 
        renderer.setPixelRatio(window.devicePixelRatio);
    }
    return renderer;
};

// The RendererWrapper is global, because it's either WEBGL or CANVAS.
var rendererWrapper = new RendererWrapper();


/**
  * SceneManager
  *
  */
var SceneManager = function() {

    this.scenes = [];

    // This is the scene pointer.  At present, scenes are built in order and
    // after that there is no further need to reference a scene.  The one
    // exception to that is the animate() function, which needs to cycle
    // through the scenes.
    //
    // The cycle() method takes care of cycling through the scenes.
    this.sp;
    this.cycle = false;
};

SceneManager.prototype.newScene = function(mapParameters) {

    if (this.sp === undefined) {
        this.sp = 0;
    } else {
        this.sp++;
    }

    // The new THREE scene.
    // The camera, renderer, controls, grid, stars, etc. are initialized
    // elsewhere.
    var scene = new THREE.Scene();
    var spaceship;
    var camera;
    var grid;
    var renderer;
    var webvr;
//    var stereoEffect;
//    var anaglyphEffect;
    var stars = [];
    var mapParameters = mapParameters;
    
    // The message line below the star map.
    var msgHandler = new MapMessageLine(mapParameters);
    
   this.scenes.push({
      scene: scene,
      spaceship: spaceship,
      camera: camera,
      grid: grid,
      renderer: renderer,
      webvr: webvr,
      effect: 'none',
//      stereoEffect: stereoEffect,
//      anaglyphEffect: anaglyphEffect,
      stars: stars,
      mapParameters: mapParameters,
      msgHandler: msgHandler
    });
};

/**
  * doWithAll()
  *
  * This function executes the callback function with every scene.
  */
SceneManager.prototype.doWithAll = function(callbackfn) {

    for (var ptr = 0; ptr < this.scenes.length; ptr++) {
        callbackfn(this.scenes[ptr]);
    }
};

SceneManager.prototype.cycle = function() {
    
    this.sp++;
    this.sp = this.sp % this.scenes.length;
}

SceneManager.prototype.setCurrentScene = function(canvasID) {
    
    if (undefined === canvasID) {
        this.sp = NO_ACTIVE_SCENE;
//        this.cycle = true;
        return;
    }
    
    var ptr = 0;
    while (this.scenes[ptr].mapParameters.canvasID !== canvasID ) {
        ptr++;
    }
    this.sp = ptr;
};

SceneManager.prototype.currentScene = function(canvasID) {

    if (undefined === canvasID) {
        if (NO_ACTIVE_SCENE === this.sp) {
            return;
        } else {
            return this.scenes[this.sp];
        }
    }
    var ptr = 0;
    while (this.scenes[ptr].mapParameters.canvasID !== canvasID ) {
        ptr++;
    }
    return this.scenes[ptr];
};

SceneManager.prototype.makeInteractive = function(mousemove, mouseover, mouseout) {
    
    for (ptr = 0; ptr < this.scenes.length; ptr++) {

        var scene = this.scenes[ptr];
        var canvasID = scene.mapParameters.canvasID;
        var elem = document.getElementById(canvasID);
//        var vrElem = document.getElementById("vr_" + canvasID);
        
        // Add a mouse movement listener so give the renderer the coordinates
        // of the mouse. Used to determine the star under the mouse pointer.
        elem.addEventListener("mousemove", mousemove, false);
        
        // Add a mouseover and mouseout event listener so that the render
        // operation is only called when the mouse is in the element that
        // holds the star map.
        elem.addEventListener("mouseover", function() {
            onMouseOver(this);
        });
        elem.addEventListener("mouseout", function() {
            onMouseOut(this);
        });
    }
};

SceneManager.prototype.addStar = function(star, mapP) {

    // Cannot rely on the order in which addStars() is called.  Therefore it is
    // required to find the scene based on the map data, specifically the
    // canvas ID.
    var ptr = 0;
    while (this.scenes[ptr].mapParameters.canvasID !== mapP.canvasID ) {
        ptr++;
    }
    this.scenes[ptr++].stars.push(star);
};

SceneManager.prototype.renderStars = function(mapP) {

    var ptr = 0;
    while (this.scenes[ptr].mapParameters.canvasID !== mapP.canvasID ) {
        ptr++;
    }

    var scene = this.scenes[ptr].scene;
    var stars = this.scenes[ptr].stars;
    var materialManager = new MaterialManager();
    
    if (WEBGL === rendererWrapper.engine) {

        // The point clouds
        var verydimGeometry = new THREE.Geometry();
        var verydimStars = new THREE.Points(verydimGeometry, materialManager.material(VERYDIM_STAR));
        var verydimColors = [];
        var verydimAttributes = [];

        var dimGeometry = new THREE.Geometry();
        var dimStars = new THREE.Points(dimGeometry, materialManager.material(DIM_STAR));
        var dimColors = [];
        var dimAttributes = [];

        var mediumGeometry = new THREE.Geometry();
        var mediumStars = new THREE.Points(mediumGeometry, materialManager.material(MEDIUM_STAR));
        var mediumColors = [];
        var mediumAttributes = [];

        var brightGeometry = new THREE.Geometry();
        var brightStars = new THREE.Points(brightGeometry, materialManager.material(BRIGHT_STAR));
        var brightColors = [];
        var brightAttributes = [];

        var verybrightGeometry = new THREE.Geometry();
        var verybrightStars = new THREE.Points(verybrightGeometry, materialManager.material(VERYBRIGHT_STAR));
        var verybrightColors = [];
        var verybrightAttributes = [];

        var markedGeometry = new THREE.Geometry();
        var markedStars = new THREE.Points(markedGeometry, materialManager.material(MARK_RING));

        var lifeGeometry = new THREE.Geometry();
        var lifeStars = new THREE.Points(lifeGeometry, materialManager.material(LIFE_RING));

        var habitableGeometry = new THREE.Geometry();
        var habitableStars = new THREE.Points(habitableGeometry, materialManager.material(HABITABLE_RING));

        var star;
        var starClass;
        for (j = 0; j < stars.length; j++) {
            star = stars[j];
            starClass = star.starClass;
            if (starClass.marked) {
                markedGeometry.vertices.push(star.vertex);
            }
            if (starClass.life) {
                lifeGeometry.vertices.push(star.vertex);
            }
            if (starClass.habitable) {
                habitableGeometry.vertices.push(star.vertex);
            }
            if (starClass.class === VERYDIM_STAR) {
                verydimGeometry.vertices.push(star.vertex);
                verydimColors.push(star.color());
                verydimAttributes.push(star.attribute);
            }
            if (starClass.class === DIM_STAR) {
                dimGeometry.vertices.push(star.vertex);
                dimColors.push(star.color());
                dimAttributes.push(star.attribute);
            }
            if (starClass.class === MEDIUM_STAR) {
                mediumGeometry.vertices.push(star.vertex);
                mediumColors.push(star.color());
                mediumAttributes.push(star.attribute);
            }
            if (starClass.class === BRIGHT_STAR) {
                brightGeometry.vertices.push(star.vertex);
                brightColors.push(star.color());
                brightAttributes.push(star.attribute);
            }
            if (starClass.class === VERYBRIGHT_STAR) {
                verybrightGeometry.vertices.push(star.vertex);
                verybrightColors.push(star.color());
                verybrightAttributes.push(star.attribute);
            }
        }

        // The colors array must be a sibling of the vertices.
        verydimGeometry.colors = verydimColors;
        dimGeometry.colors = dimColors;
        mediumGeometry.colors = mediumColors;
        brightGeometry.colors = brightColors;
        verybrightGeometry.colors = verybrightColors;
        
        // Attach the attributes.  This is not recommended practice.  Perhaps
        // better is to use THREE.BufferGeometry.  But that gets quite
        // involved.
        verydimGeometry.custAttributes = verydimAttributes;
        dimGeometry.custAttributes = dimAttributes;
        mediumGeometry.custAttributes = mediumAttributes;
        brightGeometry.custAttributes = brightAttributes;
        verybrightGeometry.custAttributes = verybrightAttributes;

        brightGeometry.computeBoundingSphere();
   
        // Update the particle system to sort the particles, which enables the
        // behavior we want.
        markedStars.sortParticles = true;
        lifeStars.sortParticles = true;
        habitableStars.sortParticles = true;
        verydimStars.sortParticles = true;
        dimStars.sortParticles = true;
        mediumStars.sortParticles = true;
        brightStars.sortParticles = true;
        verybrightStars.sortParticles = true;

        scene.add(verydimStars);
        scene.add(dimStars);
        scene.add(mediumStars);
        scene.add(brightStars);
        scene.add(verybrightStars);
        scene.add(markedStars);
        scene.add(lifeStars);
        scene.add(habitableStars);

    } else {

        var points = new THREE.Group();
        var material;
        var star;
        var starClass;
        var scale = this.scenes[ptr].mapParameters.scale;
        var cscale = Math.pow(scale, 0.85)/Math.sqrt(1000);

        for (j = 0; j < stars.length; j++) {

            star = stars[j];
            starClass = star.starClass;
            material = materialManager.material(starClass.class);
            material.color = star.color();

            var particle = new THREE.Sprite(material);
            particle.position.copy(star.vertex);

            particle.scale.set(cscale, cscale, 1);
            points.add(particle);

            if (starClass.marked) {
                var particle = new THREE.Sprite(materialManager.material(MARK_RING));
                particle.position.copy(star.vertex);
                particle.scale.set(cscale, cscale, 1);
                points.add(particle);
            }
            if (starClass.life) {
                var particle = new THREE.Sprite(materialManager.material(LIFE_RING));
                particle.position.copy(star.vertex);
                particle.scale.set(cscale, cscale, 1);
                points.add(particle);
            }
        }
        scene.add(points);
    }
}


/**
 * MaterialManager
 *
 * This class encapsulates the materials for stars and ring markers.  It
 * serves the addStars() and addSun() functions so those functions do not
 * need to know if the renderer is WEBGL or CANVAS.
 */
var MaterialManager = function() {

    var mapStar = new THREE.TextureLoader(loaderManager).load(STAR_IMG);
    var mapRing = new THREE.TextureLoader(loaderManager).load(RING_IMG);
    
    /**
     * These materials are for point systems, which use the WEBGL renderer.
     * They are all identical, except the size.  And they all have
     * vertexColors set to THREE.VertexColors, so that the color of the image
     * is set individually by star.
     */
    // Very dim stars.
    this.materialVeryDim = new THREE.PointsMaterial({
      size: 3,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapStar,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      vertexColors: THREE.VertexColors
    });
    
    // Dim stars.
    this.materialDim = new THREE.PointsMaterial({
      size: 4,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapStar,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      vertexColors: THREE.VertexColors
    });
    
    // Medium-bright stars.
    this.materialMedium = new THREE.PointsMaterial({
      size: 5,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapStar,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      vertexColors: THREE.VertexColors
    });
    
    // Bright stars.
    this.materialBright = new THREE.PointsMaterial({
      size: 6,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapStar,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      vertexColors: THREE.VertexColors
    });

    // Very bright stars.
    this.materialVeryBright = new THREE.PointsMaterial({
      size: 8,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapStar,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      vertexColors: THREE.VertexColors
    });

    /**
     * These rings are for the WEBGL renderer.  They are identical, except
     * the color.
     */
    // A ring for marking stars.
    this.materialRingMark = new THREE.PointsMaterial({
      size: 12,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapRing,
      color: 0xff0000,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 1.0
    });

    // A ring for marking the sun, and any stars with a planet known to
    // harbor life.
    this.materialRingLife = new THREE.PointsMaterial({
      size: 12,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapRing,
      color: 0x00ff00,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 1.0
    });

    // A ring for marking the stars that have confirmed exoplanets in the
    // habitable zone.  The color is blue.
    this.materialRingHabitable = new THREE.PointsMaterial({
      size: 12,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapRing,
      color: 0x0d79fe,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 1.0
    });

    /**
      * The canvas renderer does not support color and texture simultaneously.
      * Here we have chosen to do the work in the graphics editor, rather than
      * manipulate pixels with canvas methods.
      */
    this.CANVAS_STAR_MAP = new THREE.TextureLoader().load(STAR_IMG);
    this.CANVAS_RED_RING_MAP = new THREE.TextureLoader().load(MARK_RING_RED);
    this.CANVAS_GREEN_RING_MAP = new THREE.TextureLoader().load(MARK_RING_GREEN);

    // Stars (canvas renderer)
    this.program = function ( context ) {
        context.beginPath();
        context.arc( 0, 0, 0.225, 0, PI2, true );
        context.fill();
    };
    this.materialCStar = new THREE.SpriteCanvasMaterial({
        program: this.program
    });

    // Ring for marking stars (canvas renderer).
    this.materialCRingMark = new THREE.SpriteMaterial({
        map: this.CANVAS_RED_RING_MAP,
        transparent: true
    });

    // Ring for marking the sun and life (canvas renderer).
    this.materialCRingLife = new THREE.SpriteMaterial({
        map: this.CANVAS_GREEN_RING_MAP,
        transparent: true
    });
}

MaterialManager.prototype.material = function(starClass) {

    /**
      * The starClass will be one of these constants:
      *   VERYDIM_STAR
      *   DIM_STAR
      *   MEDIUM_STAR
      *   BRIGHT_STAR
      *   VERYBRIGHT_STAR
      *   MARK_RING
      *   LIFE_RING
      */
    if (WEBGL === rendererWrapper.engine) {

        // If WEBGL, then stars can be dim, medium or bright.
        switch(starClass) {
        case VERYDIM_STAR:
            return this.materialVeryDim;
            break;
        case DIM_STAR:
            return this.materialDim;
            break;
        case MEDIUM_STAR:
            return this.materialMedium;
            break;
        case BRIGHT_STAR:
            return this.materialBright;
            break;
       case VERYBRIGHT_STAR:
           return this.materialVeryBright;
            break;
        case MARK_RING:
            return this.materialRingMark;
            break;
        case LIFE_RING:
            return this.materialRingLife;
            break;
        case HABITABLE_RING:
            return this.materialRingHabitable;
            break;
        }
    } else {

        // if CANVAS, there is only one star material.
        switch(starClass) {
        case VERYDIM_STAR:
        case DIM_STAR:
        case MEDIUM_STAR:
        case BRIGHT_STAR:
        case VERYBRIGHT_STAR:
            // For the star, the material must be cloned for each star
            // to have it's own color.  Otherwise, all stars are the color
            // of the last star.
            var material = this.materialCStar.clone();
            return material;
            break;
        case MARK_RING:
            return this.materialCRingMark;
            break;
        case LIFE_RING:
            return this.materialCRingLife;
            break;
        }
    }
};


/**
 * addStars
 *
 */
function addStars(stars, mapData) {

    stars.forEach(function(d) {

        var star = new Star(d.position, d.magnitude, d.spectrum, d.temperature, d.luminosity, d.attribute, d.tagged, false, d.habitable);
        scenes.addStar(star, mapData);
    });
    scenes.renderStars(mapData);
}


/**
 * addSun()
 *
 * Places the Sun at the origin, with a green ring around it.
 */
function addSun(mapData)
{
    var sun = new Star({u: 0, v: 0, w: 0}, 4.83, "G", 5778.0, Math.NaN, "Sun", false, true, false);
    scenes.addStar(sun, mapData);
//    scenes.renderStars(mapData);
}


/**
 * CoordinateGrid
 *
 */
var CoordinateGrid = function(scale) {

    this.lines = [];

    // Lines
    var xaxis = new THREE.Geometry();
    var yaxis = new THREE.Geometry();
    var zaxis = new THREE.Geometry();

    xaxis.vertices.push(new THREE.Vector3(-scale, 0, 0));
    xaxis.vertices.push(new THREE.Vector3(+scale, 0, 0));

    yaxis.vertices.push(new THREE.Vector3(0, -scale, 0));
    yaxis.vertices.push(new THREE.Vector3(0, +scale, 0));

    zaxis.vertices.push(new THREE.Vector3(0, 0, -scale));
    zaxis.vertices.push(new THREE.Vector3(0, 0, +scale));

    for (var d = -1; d <= 1; d++)
    {
        // The line material definitions are inside the four loop because the line
        // colors get less opaque as they get farther from the galactic plane.
        var xaxisMaterial = new THREE.LineBasicMaterial({
            color: 0xffff99,
            transparent: true,
            opacity: 0.3 - Math.abs(d/10)
        });
        var yaxisMaterial = new THREE.LineBasicMaterial({
            color: 0x99ffff,
            transparent: true,
            opacity: 0.3 - Math.abs(d/10)
        });

        for (var c = -5; c <= 5; c++) {
            var xline = new THREE.Line(xaxis, xaxisMaterial);
            xline.position.y = c*scale/5;
            xline.position.z = d*scale/5;
            this.lines.push(xline);
    
            var yline = new THREE.Line(yaxis, yaxisMaterial);
            yline.position.x = c*scale/5;
            yline.position.z = d*scale/5;
            this.lines.push(yline);
        }
    }
    
    //The grid spacing for the message line.
    this.gridSpacing = scale/10;
};

CoordinateGrid.prototype.joinScene = function(scene) {

    for (var i = 0; i < this.lines.length; i++) {
        scene.add(this.lines[i]);
    }
}


/**
 * CoordinateCylidricalGrid
 *
 */
var CylindricalGrid = function(scale) {
	
	// These units have to be in meters, because the WebVR world is in meters.
	// The variable scale is the scene radius in ly (see the init() function in
	// orion.js).  So these values are given in light years and then
	// immediately converted to meters.

    const R_0 = 25900*STD_SCALE;	 // distance from center to the sun (ly)
    const radius = 60000*STD_SCALE;  // radius of the Milky Way (ly)
    const divisions = 32;
    var color1 = new THREE.Color(0xffff99);
    var color2 = new THREE.Color(0x99ffff);

    var vertices = [];
    var colors = [];

    var xi, yi, xo, yo, x, y, z;
    var v, i, j, r;
    
    // The angular width relates to scale as sin(theta_max) = scale/R_0, where
    // R_0 is the distance to the center of the galaxy.
    //
    // If the scale is greater that R_0, then as a temporary measure, limit it
    // to 80% or R_0.
    var theta_max;
    if (SCENE_RADIUS < R_0) {
        theta_max = Math.atan(SCENE_RADIUS/(R_0 - SCENE_RADIUS));
    }
    else {
        theta_max = Math.atan(SCENE_RADIUS/0.2);
    }

    for (k = -1; k <= 1; k++) {

        // Create the radials.
        for (i = -10; i <= 10; i ++) {
            v = (i/10)*(theta_max);
            xi = R_0 - Math.cos(v)*(R_0 - SCENE_RADIUS);
            yi = -Math.sin(v)*(R_0 - SCENE_RADIUS);
            xo = R_0 - Math.cos(v)*(R_0 + SCENE_RADIUS);
            yo = -Math.sin(v)*(R_0 + SCENE_RADIUS);

            vertices.push(xi, yi, k*SCENE_RADIUS/10);
            vertices.push(xo, yo, k*SCENE_RADIUS/10);

            colors.push(color1.r, color1.g, color1.b);
            colors.push(color1.r, color1.g, color1.b);
        }

        // Create the circles.
        for (i = 0; i <= 20; i ++) {
            r = R_0 + SCENE_RADIUS - (2*SCENE_RADIUS/20)*i;

            for (j = 0; j < divisions; j ++) {

                // First vertex.
                v = (2*theta_max/divisions)*j - theta_max;
                x = R_0 - Math.cos(v)*r;
                y = -Math.sin(v)*r;

                vertices.push(x, y, k*SCENE_RADIUS/10);
                colors.push(color2.r, color2.g, color2.b);

                // Second vertex
                v = (2*theta_max/divisions)*(j + 1) - theta_max;
                x = R_0 - Math.cos(v)*r;
                y = -Math.sin(v)*r;

                vertices.push(x, y, k*SCENE_RADIUS/10);
                colors.push(color2.r, color2.g, color2.b);
            }
        }
    }

    var geometry = new THREE.BufferGeometry();
    geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    geometry.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );

    var material = new THREE.LineBasicMaterial({
        vertexColors: THREE.VertexColors,
        transparent: true,
        opacity: 0.2
    });

    THREE.LineSegments.call( this, geometry, material );
    
    // The grid spacing for the message line.
    this.gridSpacing = scale/10;
}

CylindricalGrid.prototype = Object.create( THREE.LineSegments.prototype );
CylindricalGrid.prototype.constructor = CylindricalGrid;

CylindricalGrid.prototype.joinScene = function(scene) {

    scene.add(this);
}


/**
  * StarClass
  *
  */
var StarClass = function(magnitude, marked = false, life = false, habitable = false) {

    if (magnitude < 0.0) {
        this.class = VERYBRIGHT_STAR;
    }
    else if (magnitude < 1.0) {
        this.class = BRIGHT_STAR;
    }
    else if (magnitude < 2.0) {
        this.class = MEDIUM_STAR;
    }
    else if (magnitude < 3.0) {
        this.class = DIM_STAR;
    }
    else {
        this.class = VERYDIM_STAR;
    }
    this.marked = marked;
    this.life = life;
    this.habitable = habitable;
};


/**
 * Star
 *
 */
var Star = function(position, magnitude, spectrum, temperature, luminosity, attr, marked = false, life = false, habitable = false) {

    // The subjective color scheme for the colors of stars is closer to what
    // one expects to see.
    this.colorScheme = STARCOLORS_SUBJECTIVE;
    
    this.vertex = new THREE.Vector3(position.u, position.v, position.w);
    this.starClass = new StarClass(magnitude, marked, life, habitable);

    this.temperature = temperature;
    this.luminocity = luminosity;
    this.magnitude = magnitude;
    this.spectrum = spectrum;
    this.attribute = attr;
};

Star.prototype.spectralClass = function() {
    
    if (this.spectrum !== undefined) {
        return this.spectrum;
    }
    if (this.temperature === undefined) {
        return "";
    }
    else {
        if (this.temperature > 25000.0) {
            return "O";
        }
        if (this.temperature > 10000.0) {
            return "B";
        }
        if (this.temperature > 7500.0) {
            return "A";
        }
        if (this.temperature > 6000.0) {
            return "F";
        }
        if (this.temperature > 5000.0) {
            return "G";
        }
        if (this.temperature > 3500.0) {
            return "K";
        }
        if (this.temperature <= 3500.0) {
            return "M";
        }
    }
};

Star.prototype.color = function() {

    var color = new THREE.Color();
    var spectralClass = this.spectralClass();
    color.set(this.colorScheme.color(spectralClass));
    var hslColor = new THREE.Color();
    color.getHSL(hslColor);
    var hue = hslColor.h;


    // Adjust the saturation and value based on the brightness of the star.
    // Very dim stars are grey (#999999).  The saturation is 0 and the value
    // is 0.80.
    if (this.starClass.class === VERYDIM_STAR) {
        color.set(0x999999);
        return color;
    }
    
    // Dim stars and medium stars are intermediate.  The saturation is 2 and
    // the value is 0.90.
    if (this.starClass.class === DIM_STAR) {
        color.setHSL(hue, 0.04, 0.80);
        return color;
    }
    if (this.starClass.class === MEDIUM_STAR) {
        color.setHSL(hue, 0.04, 0.80);
        return color;
    }
    
    // The bright stars has saturation of 4, so that a little of the color is
    // percievable.  The magnitude is 100%.
    if (this.starClass.class === BRIGHT_STAR) {
        color.setHSL(hue, 0.99, 0.99);
        return color;
    }
    if (this.starClass.class === VERYBRIGHT_STAR) {
        color.setHSL(hue, 0.99, 0.98);
        return color;
    }

    return color;
};

function launchVR(buttonType, currentScene) {

    if (WEBGL !== rendererWrapper.engine) {
        var msg = "Attempt to set effect to stereo ignored.";
        msg = msg + " WebGL renderer is not in use.";
        console.warn(msg);
        return;
    }
    
    currentScene.webvr.activateVR();
    return;

};

function playMovie(buttonType, currentScene) {
    if (WEBGL !== rendererWrapper.engine) {
        var msg = "Attempt to start playing movie animation ignored.";
        msg = msg + " WebGL renderer is not in use.";
        console.warn(msg);
        return;
    }
    currentScene.animation = 'movie';
    
    // Calculate the unit vector that points in the direction the camera is
    // looking.
    var p = currentScene.spaceship.position.clone();
    p.normalize();
    p.multiplyScalar(-1*MOVIE_STEP);
    currentScene.movieDirection = p;
    renderOnce(currentScene);
};

function pauseMovie(buttonType, currentScene) {
    if (WEBGL !== rendererWrapper.engine) {
        var msg = "Attempt to stop playing movie animation ignored.";
        msg = msg + " WebGL renderer is not in use.";
        console.warn(msg);
        return;
    }
    currentScene.animation = 'animate';
    renderOnce(currentScene);
};

/**
 * MapMesasgeLine
 * 
 * @param {type} canvasID
 * @returns {MapMessageLine}
 */
var MapMessageLine = function(mapParameters) {
    
    // The canvas DOM element and the scene that owns this.
    this.canvasID = mapParameters.canvasID;
    this.mapParameters = mapParameters;
    
    // Remember which renderer being used.
    this.engine = rendererWrapper.engine;
    
    // The number of stars.  Either this is displayed as "# stars", or in its
    // place the attribute (e.g., Arcturus) from the star data source.
    this.numberStars = 0;
    this.attribute = "";
    this.waitingMsg = "";
    this.stars = "";
    
    // The VR and movie play buttons.
    this.buttonVR = new Button("vr", "icon-cardboard", this.canvasID, launchVR);
    this.buttonMV = new Button("mv", "icon-play", this.canvasID, playMovie, pauseMovie)
    
    this.renderer = "---";
    this.scale = "---";
    this.starInfo = "---";
    this.errorMsg = "";
    this.msg = "Initializing...";
    this.state = MSG_INFO;
    this.dataState = MSG_DATA_WAITING;
    
    this.mediumMinWidth = 255;
    this.largeMinWidth = 375;
};

MapMessageLine.prototype.getButtonByType = function(type) {
    switch(type) {
        case "vr":
            return this.buttonVR;
            break;
        case "mv":
            return this.buttonMV;
            break;
    }
}

MapMessageLine.prototype.init = function (engine, grid) {
    
    // These are both known at the time the DOM element that holds the scene is
    // initialized.
    if (WEBGL === engine) {
        this.renderer = "WebGL";
    } else {
        this.renderer = "Canvas";
    }
	this.scene = scenes.currentScene(this.canvasID);

    this.grid = grid;
    var sp = this.grid.gridSpacing;
    
    // The scale and grid spacing needs to consider the width of the star map.
    // So there are three size ranges:
    // 
    //     1) The smallest < mediumMinWidth px
    //     If the attribute is truncated, it's first clipped by the first
    //     space, or then n chars.
    //     WebGL  | 125 ly  | [#### | trunc. attr]
    //     
    //     2) Medium [mediumMinWidth, largeMinWidth) px
    //     If the attribute is truncated, it's first clipped by the second
    //     space, or then n chars.
    //     WebGL  | Grid: 125 ly | [#### stars | trunc. attr]
    //     
    //     3) The largest >= largeMinWidth px
    //     WebGL  | Grid spacing: 125 ly | [#### stars | attr]
    //
    if (this.mapParameters.width < this.mediumMinWidth) {
        
        // Small
        this.scale = sp.toString() + "&thinsp;ly";

    } else if (this.mapParameters.width < this.largeMinWidth) {
        
        // Medium
        this.scale = "Grid: " + sp.toString() + "&thinsp;ly";

    } else {
        
        // Large
        this.scale = "Grid spacing: " + sp.toString() + "&thinsp;ly";
    }
};

MapMessageLine.prototype.setNumberStars = function(nbrStars) {
    
    this.numberStars = nbrStars;
    this.stars = this.numberStars.toString();
    if (this.mapParameters.width >= this.mediumMinWidth) {
        
        // Medium, large
        this.stars = this.stars + " stars";
    }

    this.state = MSG_NORMAL;
    this.update();
};

MapMessageLine.prototype.sizeMsg = function(message) {

    var wlist = message.split(" ");
    var maxlen;
    if (this.mapParameters.width < this.mediumMinWidth) {
        maxlen = 8;
    } else if (this.mapParameters.width < this.largeMinWidth) {
        maxlen = 15;
    } else {
        maxlen = 30;        
    }
    
    var msg = "";
    var i = 0;
    do {
        msg = msg + (i===0?"":" ") + wlist[i];
        i++;
    }
    while (i < wlist.length && (msg + " " + wlist[i]).length < maxlen);

    // One word could be too long.
    if (msg.length > maxlen) {
        msg = msg.substring(0, maxlen - 4) + '...';
    };
    return msg;
};

MapMessageLine.prototype.reset = function() {
    this.dataState = MSG_DATA_OK;
    this.update();
}
    
// This function is for errors with the star data that occur after the star
// map scene has been rendered, and animation has started.
MapMessageLine.prototype.setError = function(err) {
    
    console.error(err);
    this.errorMsg = this.sizeMsg(err);
    this.dataState = MSG_DATA_ERROR;
    this.state = MSG_NORMAL;
    this.update();
};

// This function is for displaying a waiting status.  It indicates that
// the scene is waiting for stars from a remote server.  It's used when the
// scene has already be built.
MapMessageLine.prototype.setWaiting = function(msg) {
    
    this.waitingMsg = this.sizeMsg(msg);
    this.dataState = MSG_DATA_WAITING;
    this.state = MSG_NORMAL;
    this.update();
};

MapMessageLine.prototype.setAttribute = function(attr) {
    
    this.attribute = this.sizeMsg(attr);
    this.dataState = MSG_DATA_ATTRIBUTE;
    this.state = MSG_NORMAL;
    this.update();
};

MapMessageLine.prototype.update = function() {
    
    var html;
    var id = "msg_" + this.canvasID;
    var msgline = document.getElementById(id);
    
    // The right field in the message line can be the number of stars,
    // the attribute of a particular star, or a state like waiting or failed.
    switch (this.dataState) {
        case MSG_DATA_WAITING:
            this.starInfo = this.waitingMsg;
            break;
        case MSG_DATA_ERROR:
            this.starInfo = this.errorMsg;
            break;
        case MSG_DATA_OK:
            this.starInfo = this.stars;
            break;
        case MSG_DATA_ATTRIBUTE:
            this.starInfo = this.attribute;
            break;
    }
    
    switch(this.state) {
        case MSG_INFO:
            html = "<table class='starMapMsg' width='100%'><tr>"
                    + "<td>" + this.msg; + "</td>"
                    + "</tr></table>";
            break;
        case MSG_NORMAL:
            html = "<table class='starMapMsg' width='100%'><tr>"
                    + "<td style='width: 70px;'>";
            if ('WebGL' === this.renderer) {
                    html = html + this.buttonVR.html() + this.buttonMV.html();
            } else {
                    html = html + this.renderer;
            }
            html = html + "</td>"
                    + "<td style='width: 40%;'>" + this.scale + "</td>"
                    + "<td style='width: 60%;'>" + this.starInfo + "</td>"
                    + "</tr></table>";
            break;
        case MSG_ERROR:
            html = "<table class='starMapMsg' width='100%'><tr>"
                    + "<td>" + this.errorMsg; + "</td>"
                    + "</tr></table>";
            break;
    }
    msgline.innerHTML = html;
};

MapMessageLine.prototype.info = function(msg) {
    
    this.state = MSG_INFO;
    this.msg = msg;
    this.update();
};

MapMessageLine.prototype.err = function(errMessage) {

    this.state = MSG_ERROR;
    this.errorMsg = errMessage;
    this.update();
};

MapMessageLine.prototype.normal = function() {
    
    // This function does get called before the number of stars has been
    // learned.
    this.state = MSG_NORMAL;
    if (this.numberStars !== undefined) {
        
        this.starInfo = this.numberStars.toString();
        if (this.mapParameters.width >= this.mediumMinWidth) {
        
            // Medium, large
            this.starInfo = this.starInfo + " stars";
        }
    } else {
        this.starInfo = "---";
    }
    this.update();
};


// I expect there's a better way for an element to call a method of its
// corresponding object.
function buttonAction(type, canvasId) {
    var currentScene = scenes.currentScene(canvasId);
    var button = currentScene.msgHandler.getButtonByType(type);
    button.action();
};

/**
 * Button parent class
 * 
 * type should be "vr" or "mv"
 * icon should be the id in the SVG file.  It's the xlink:href here.
 */
var Button = function(type, icon, canvasId, forwardAction, reverseAction) {
    
    // These are callback functions.
    this.forwardAction = forwardAction;
    if (reverseAction !== undefined) {
    	this.reverseAction = reverseAction;
    }
    
    // These are properties.
    this.canvasId = canvasId;
    this.icon = icon;
    this.type = type;
    this.id = type + "_" + canvasId;
    this.enabled = false;
    this.active = false;
};

Button.prototype.html = function(enabled = true) {
    
    var svgclass;
    if (enabled) {
        svgclass = 'svgicon';
    }
    else {
        svgclass = 'svgiconDisabled';
    }
    
    var html = "<svg class='" + svgclass + "'"
        + " id='" + this.id + "'"
        + " viewBox='0 0 100 100' width='2em'"
        + " onClick='buttonAction(&apos;" + this.type + "&apos;, &apos;" + this.canvasId + "&apos;)'>"
        + "<use xlink:href='#" + this.icon + "'></use></svg>";    
    return html;
}

/**
 * acquireElement()
 * 
 * If the DOM element exists, save it as part of the object, so that it only
 * needs to be discovered once.
 * 
 * NOTE: It is presumed that there is only one instance of each button type
 * per canvas (canvasId).
 */
Button.prototype.acquireElement = function() {
    if  (undefined === this.elem) {
        this.elem = document.getElementById(this.id);
   }
   return this.elem;
}
Button.prototype.acquireScene = function() {
    if (undefined === this.currentScene) {
        this.currentScene = scenes.currentScene(this.canvasId);
    }
    return this.currentScene;
}

Button.prototype.doAction = function() {
    this.currentScene = this.acquireScene();
    if (undefined !== this.currentScene) {
        this.forwardAction(this.type, this.currentScene, this.elem);
    }
}
Button.prototype.undoAction = function() {
    this.currentScene = this.acquireScene();
    if (undefined !== this.currentScene && undefined !== this.reverseAction) {
        this.reverseAction(this.type, this.currentScene, this.elem);
    }
}
 
Button.prototype.action = function() {
    
    var elem = this.acquireElement();
    if (undefined === elem) {
        return;
    }
    
    if (this.active) {
        elem.style.fill = '#bbb';
        this.undoAction();
        this.active = false;
    } else {
        elem.style.fill = '#fff';
        this.doAction();
        this.active = true;
    }
};
