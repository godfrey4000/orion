/*
** Parameters passed from WordPress Orion plugin to the sceneData object.
** These paramaters are set as properties of the [orion] shortcode.
**
**   scale            -- This is the distance from the center to the edge of
**                    -- the grid, measured in light years.
**                    (default 100)
**   width            (default 400)
**   height           (default 400)
**   position         -- The camera always looks at the origin.  This direction
**                    -- of sight is the negative of this vector.  It is a json
**                    -- string of the form position="x, y, z".
**                    (default: 0, 0, STD_SCALE*OBSERVER_DISTANCE)
**    source          -- The collection of stars to display.
**    sun             -- If true, the Sun is displayed at the origin.
**                    (default true)
*/   

// THREE constants.
const THREE_POINTS = "Points";
const INCHES_TO_METERS = 0.0254;

// SCENE GEOMETRY CONSTANTS
// 
// The scene is intended to fit on top of a large dining room table, to give
// the viewer a satisfying 3D perspective.  The viewer, when the scene is
// initial rendered, is 60 inches from the center of the scene, and the scene
// fits inside a sphere of radius 36 inches.
// 
// Units:
// The units for setting the constants prescribing the camera characteristics
// are in inches.  These are the constants just below.  The unit of the WebVR
// is meters.  This is why the constants are written first in inches and then
// immediately converted to meters.
//      The data from star catalogs typically gives distances in kilo-parsecs.
// The routines in astro.js then convert them to light-years.  To display the
// intended collection of stars just above the dining root table, a scale must
// be introduced that converts light-years to inches (and then to meters).
//      The scale parameter is the distance from the center of the scene to the
// edge, in light years.  This establishes the conversion factor.  (See comment
// below.)
const SCENE_RADIUS = 24*36*INCHES_TO_METERS;
const OBSERVER_DISTANCE = 24*60*INCHES_TO_METERS;
const CAMERA_NEAR = 24*0.5*INCHES_TO_METERS;
const CAMERA_FAR = 24*1080*INCHES_TO_METERS; // 90 feet

const PERSPECT = OBSERVER_DISTANCE/SCENE_RADIUS;
const CAMERA_FOV = 2*180/Math.PI*Math.asin(SCENE_RADIUS/OBSERVER_DISTANCE);

// The screen width, from one edge to the other in the x-direction, in the x-y
// plane.  The conversion factor is this value in inches = the parameter scale
// in light years.  The factor will be calculated in init() when the scale
// parameter is known.
const SCREEN_WIDTH = 2*OBSERVER_DISTANCE*Math.tan(Math.PI/360*CAMERA_FOV);
var STD_SCALE;
var CAMERA_DISTANCE; // Initial distance of the camera, in light years.

// The camera advances by this many light years per frame in movie mode.  These
// values are set in init().
var MOVIE_STEP;
//var MOVIE_DIRECTION;

var container, controls, orbitControls;

// Catch the exit from fullscreen and restore the proper width,height of all
// the maps.
if (document.addEventListener) {
    document.addEventListener('webkitfullscreenchange', screenHandler, false);
    document.addEventListener('mozfullscreenchange', screenHandler, false);
    document.addEventListener('fullscreenchange', screenHandler, false);
    document.addEventListener('MSFullscreenChange', screenHandler, false);
}

function screenHandler() {
    
    // The fullscreen API is browser specific.  If these properties are not
    // null, the browser (and therefore one of its elements) is in fullscreen
    // mode.
    if (document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement) {
    } else {
        scenes.doWithAll(function(currentScene) {
            var w = currentScene.mapParameters.width;
            var h = currentScene.mapParameters.height;
            
            // Don't need the device orientation controls.  With both,
            // movement is too chaotic.
            controls.disconnect();

            currentScene.effect = 'none';
            currentScene.renderer.setSize(w, h);
            renderOnce(currentScene);
        });
    }
}

// Objects for identifying the star under the mouse pointer and displaying
// the attribute.  The units of the threshold are lightyears.  The mean
// separation of stars in the solar neighborhood is about 4 ly.  25% of this
// value seems to work well.
var raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 1.0;
var mouse = new THREE.Vector2();

/**
  * Each canvas DOM element on the page is a star map.  The scene is the
  * collection of grid lines, stars and marking rings.  The SceneManager
  * holds all the scene data.
  */
var starMaps = document.getElementsByClassName('starMap');
var scenes = new SceneManager();
for (var i = 0; i < starMaps.length; i++) {

    console.log('canvas found: ' + starMaps[i].id);
    try {
        mapData = JSON.parse(starMaps[i].dataset.mapParams);
        scenes.newScene(mapData);

        // Draw the star map.
        draw(mapData);
    }
    catch (err) {
        console.error(err.message);
    }
};

// Make the star maps interactive and start the animate loop.  Doing it here
// should call the loop only once (I think).
// scenes.doWithAll(renderOnce);
//scenes.makeInteractive(onMouseMove, onMouseOver, onMouseOut);
jQuery('document').ready( function() {
    scenes.doWithAll(renderOnce);
});
//animate();
animate_vr();


/*
 * draw()
 *
 * Draws the scene from the star map data.
 */
function draw(mapData)
{
    // The message line handler for the current scene.
    var msgHandler = scenes.currentScene(mapData.canvasID).msgHandler;
    
    // Initialize the camera, renderer, the black space box and the
    // coordinate grids.
    init(mapData);

    // Include the sun if requested.  Do it before the rest of the stars,
    // because adding the rest of the stars triggers rendering them and adding
    // them to the scene.
    if (mapData.sun) {
        addSun(mapData);
    };

    // Read the data.  The possible instructions from the shortcode [orion]
    // are:
    //     service="<ADQL service>" adql="<the ADQL query>"
    // or
    //     source="<csv filename, without the csv suffix>"
    //
    var starData = [];
    if (mapData.adlQuery) {
        
        // Display on the message line that the query has started.  Sometimes
        // the wait for a response can be long.
        msgHandler.setWaiting("Retrieving stars from " + mapData.service);
        
        jQuery.post(mapData.server,
          { FORMAT: "CSV",
            LANG: "ADQL-2.0",
            QUERY: mapData.query
          }, function(data, status) {

            // Parse the returned CSV.  **FIX ME** Need to handle synchronous
            // communication.
            var parsedData = d3.csv.parse(data);
            consumeData(msgHandler, mapData, parsedData);

      }).fail(function(obj) {
            var errMsg = obj.status + ": " + obj.statusText;
            msgHandler.setError(errMsg);
        });
        
    }
    else {

        msgHandler.info("Loading star data...");
        d3.csv(mapData.source, function(obj, parsedData)
        {
            if (obj) {
                var errMsg = obj.status + ": " + obj.statusText;
                msgHandler.setError(errMsg);
            } else {
                consumeData(msgHandler, mapData, parsedData);
            }
        });
    };
};


/* consumeData()
 * 
 * @param {type} sceneP
 * @returns {undefined}
 */
function consumeData(msg, mapData, csv) {
    
    var scene = scenes.currentScene(mapData.canvasID);
    try {
        var starData = toGal(csv, STD_SCALE);
        msg.setNumberStars(starData.length);
        addStars(starData, mapData);
        msg.reset();
    }
    catch (err) {
        msg.setError(err.message);
    }
}

/*
** init()
**
*/ 
function init(sceneP) 
{
    var currentScene = scenes.currentScene(sceneP.canvasID);
    var scene = currentScene.scene;
    var msgHandler = currentScene.msgHandler;

    // THIS IS VERY STRANGE
    // When building the cylindrical coordinate grid java script sometimes
    // adds 25900 + "125" and returns 26025 as an integer, and sometimes
    // adds 25900 + "125" and returns 25900125 AS AN INTEGER!
    // Safer to make scale an integer from the start.
    var scale = parseInt(sceneP.scale);
    
    // This is the conversion meters to light years.  See comments at the top
    // of this file.
    STD_SCALE = SCENE_RADIUS/scale;

    // The next section creates the camera and the spaceship.  The spaceship
    // can move; the camera is firmly affixed to the spaceship's nose.  The
    // spaceship is a dimensionless object, and as such, has no orientation.
    // For this reason, the camera a spaceship are positioned by means of a
    // translation instead of setting the position property.  The latter
    // approach can introduce an unwanted rotation.
    //
    // The camera.
    var camera = new THREE.PerspectiveCamera(
            CAMERA_FOV,
            sceneP.width/sceneP.height,
            CAMERA_NEAR,
            CAMERA_FAR);
    
    // The spaceship.
    var spaceship = new THREE.Object3D();
    
    // Default initial position of the camera is a position on a line
    // perpendicular to the galactic plane, directly above the sun, at a
    // distance so that the 20x20 grid is just entirely in view.
    //      Both the spaceship and the camera must be positioned appropriately
    // first.  Then they are combined and the two move susequently as a single
    // unit.
    var origin = new THREE.Vector3();
    if (sceneP.position !== undefined) {
    	
        // The camera, and spaceship are placed at the specified position,
    	// pointing at the sun, which is located at the origin.
        position = new THREE.Vector3().fromArray(sceneP.position);
        position.multiplyScalar(STD_SCALE);
        spaceship.position.copy(position);
        spaceship.up.set(0, 0, 1);
    }
    else {
    	spaceship.position.set(0, 0, OBSERVER_DISTANCE);
    }
    camera.rotateY(Math.PI);
    spaceship.add(camera);
    scene.add(spaceship);
    
    // The movie step is based on 16 frames per second for a five-minute pass
    // from PERSPECT*scale to the opposite PERSPECT*scale.
    MOVIE_STEP = (2*OBSERVER_DISTANCE)/(5*60*64);
    var movieDirection = spaceship.position.clone();
    movieDirection.normalize();
    movieDirection.multiplyScalar(-1*MOVIE_STEP);
    
    // The renderer.
    var renderer = rendererWrapper.newRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(sceneP.width, sceneP.height);
    container = document.getElementById(sceneP.canvasID);
    container.appendChild(renderer.domElement);
    orbitControls = new THREE.OrbitControls( spaceship, renderer.domElement );
    orbitControls.enableZoom;
    
    // The WebVR manager.
    var webvr = new WebVRManager(renderer);
    

    // The blue and yellow coordinate grid.
    var grid = new CylindricalGrid(scale);
    grid.joinScene(scene);

    // Save the scene.
    currentScene.spaceship = spaceship;
    currentScene.camera = camera;
    currentScene.movieDirection = movieDirection;
    currentScene.grid = grid;
    currentScene.renderer = renderer;
    currentScene.webvr = webvr;
    
    // Update the message line.
    msgHandler.init(rendererWrapper.engine, grid);
};


function onMouseMove(event) {
    
    var scene = scenes.currentScene();
    if (undefined === scene) {
        return;
    }
    var canvasID = scene.mapParameters.canvasID;
    var container = document.getElementById(canvasID);
    var rect = container.getBoundingClientRect();
    
    // The current position of the mouse.
    var p = {x: event.clientX, y: event.clientY};
    
    // The position relative to the starmap canvas, and scaled to the interval
    // (-1, 1)x(-1, 1).  the y-coordinate on the web page increases downward on
    // the page, but the coordinates for THREE increase upward, like a standard
    // x-y coordinate graph.
    var w = rect.right - rect.left;
    var h = rect.bottom - rect.top;
    var pc = {
        x: 2*(p.x - rect.left)/w - 1,
        y: -2*(p.y - rect.top)/h + 1
    };
    
    mouse.x = pc.x;
    mouse.y = pc.y;   
    
    // Reset the message line.
    scene.msgHandler.reset();
};


function onMouseOver(elem) {
    var canvasID = elem.id;
    scenes.setCurrentScene(elem.id);
}
function onMouseOut(elem) {
  
    scenes.setCurrentScene();
}

function flipScene() {
	var currentScene = scenes.currentScene();
	var spaceship = currentScene.spaceship;
	spaceship.rotateY(Math.PI);
}

function animate_vr()
{
	currentScene = scenes.currentScene();
	currentScene.renderer.setAnimationLoop( animate );
}

function animate()
{
//    requestAnimationFrame( animate );

    // Check for a scene with focus.
    var currentScene = scenes.currentScene();
    if (undefined === currentScene) {
        return;
    }
    var spaceship = currentScene.spaceship;
    
//    orbitControls.update();

    // If movie playback is active, advance the camera position.
    if (currentScene.animation === 'movie') {
        
        // The value for step is in light-years per frame.
        var p = new THREE.Vector3(0, 0, 0);
        p.copy(spaceship.position);

        // Move the camera one MOVIE_STEP.
        p = p.add(currentScene.movieDirection);
        spaceship.position.copy(p);
    }
    
    // And then render the scene.
    render();
};


function render()
{
    // Check for a scene with focus.
    currentScene = scenes.currentScene();
    if (undefined === currentScene) {
        return;
    }

    var scene = currentScene.scene;
    var camera = currentScene.camera;
    var msgHandler = currentScene.msgHandler;
    
    raycaster.setFromCamera(mouse, camera);
    var intersects = raycaster.intersectObjects(scene.children);
    
    // When the starmap first renders, the mouse coordinates are (0,0) and
    // everything in the scene is selected.  Thereafter, normally, there should
    // only be 6 gridlines at most and a couple stars.  So limiting the
    // number of selected items to less that 10 excludes the condition at
    // startup.
    //
    // TODO: The raycaster object has a intersetObject method that can
    // consider only the Points objects.  That will solve this problem, plus
    // it's more efficient.
    if (intersects.length < 10) {
        for (var k = 0; k < intersects.length; k++) {
            var obj = intersects[k].object;
            if (THREE_POINTS === obj.type) {
                
                // Check that we have custom attributes.  The red, blue and
            	// green rings are point systems, but they don't have custom
                // attributes.
                if (undefined !== obj.geometry.custAttributes) {

                    // Dig the attribute out of the object.  This could
                    // probably be handled better.
                    var index = intersects[k].index;
                    var attr = obj.geometry.custAttributes[index];
                    if (attr !== undefined && attr.length > 0) {
                        msgHandler.setAttribute(attr);
                    }
                }
            }
        }
    }

/*
    var camera = currentScene.camera;
    var camerav = camera.getWorldDirection();
    var messageHandler = currentScene.msgHandler;

    var pos = camerav;
    var x = Math.round(pos.x*100)/100;
    var y = Math.round(pos.y*100)/100;
    var z = Math.round(pos.z*100)/100;

    var msg = "Camera: (" + parseFloat(x) + ", " + parseFloat(y) + ", " + parseFloat(z) + ")";

    pos = camera.position;
    var x = Math.round(pos.x*100)/100;
    var y = Math.round(pos.y*100)/100;
    var z = Math.round(pos.z*100)/100;
    msg = msg + "| (" + parseFloat(x) + ", " + parseFloat(y) + ", " + parseFloat(z) + ")";

    var sw = screen.width;
    var sh = screen.height;

//   messageHandler.info("WxH: " + parseInt(sw) + "x" + parseInt(sh));
*/
    renderOnce(currentScene);
};


function renderOnce(currentScene) {
    
    var scene = currentScene.scene;
    var camera = currentScene.camera;
    var renderer = currentScene.renderer;
    renderer.render(scene, camera);
}
