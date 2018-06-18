/*
** Parameters passed from WordPress Orion plugin to the sceneData
** object.  These paramaters are set as properties of the [orion]
** shortcode.
**
**   scale            -- This is the distance from the center
**                    -- to the edge, measured in light years.
**                    (default 100)
**   width            (default 400)
**   height           (default 400)
**   position         -- The camera always looks at the origin.
**                    -- This direction of sight is the negative
**                    -- of this vector.
**                    (default
**                       z = 1.2*SCALE/tan(22.5 deg)
**                       x,y = 0)
**    source          -- The collection of stars to display.
**    sun             -- If true, the Sun is displayed at the origin.
**                    (default true)
*/   

// THREE constants.
const THREE_POINTS = "Points";

// SCENE GEOMETRY CONSTANTS
// 
// The scene is intended to fit on top of a large dining room table, to give
// the viewer a satisfying 3D perspective.  The viewer, when the scene is
// initiall rendered, is 60 inches from the center of the scene, and the scene
// fits inside a sphere of radius 36 inches.
// 
// Units:
// The units for setting the constants prescribing the camera charactristics
// are in inches.  These are the constants just below.  The application,
// however is in light years, and so a scale to map inches to light years is
// calculated from the scale parameter passed to this probram.
//
// The scale parameter is the distance from the center of the scene to the
// edge, in light years.  This establishes the conversion factor.  (See comment
// below.)
const SCENE_RADIUS = 36;
const OBSERVER_DISTANCE = 60;
const CAMERA_NEAR = 2;
const CAMERA_FAR = 360; // 30 feet
const EYE_SEPARATION = 3;

const PERSPECT = OBSERVER_DISTANCE/SCENE_RADIUS;
const CAMERA_FOV = 2*180/Math.PI*Math.asin(SCENE_RADIUS/OBSERVER_DISTANCE);

// The screen width, from one edge to the other in the x-direction, in the x-y
// plane.  The conversion factor is this value in inches = the parameter scale
// in light years.  The factor will be calculated in init() when the scale
// parameter is known.
const SCREEN_WIDTH = 2*OBSERVER_DISTANCE*Math.tan(Math.PI/360*CAMERA_FOV);
var STD_SCALE;
var CAMERA_DISTANCE; // Initial distance of the camera, in light years.

// The camera advances by this many lightyears per frame in movie mode.  These
// values are set in init().
var MOVIE_STEP;
var MOVIE_DIRECTION;

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
scenes.makeInteractive(onMouseMove, onMouseOver, onMouseOut);
jQuery('document').ready( function() {
    scenes.doWithAll(renderOnce);
});
animate();


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
        
    } else {

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
        var starData = toGal(csv, 1);
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
    //      Safer to make scale an integer from the start.
    var scale = parseInt(sceneP.scale);
    
    // This is the conversion inches to light years.  See comments at the top
    // of this file.  Half the screen width in inches equals the scale in
    // light years.
    STD_SCALE = 2*scale/SCREEN_WIDTH;

    camera = new THREE.PerspectiveCamera(
            CAMERA_FOV,
            sceneP.width/sceneP.height,
            STD_SCALE*CAMERA_NEAR,
            STD_SCALE*CAMERA_FAR);
    scene.add(camera);
    
    // Default initial position of the camera is a position on a line
    // perpendicular to the galactic plane, directly above the sun, at a
    // distance so that the 11x11 grid is just entirely in view.
    var origin = new THREE.Vector3();
    if (sceneP.position !== undefined) {
        // The camera is placed at the specified position, pointing at the sun,
        // which is located at the origin.
        position = sceneP.position
        var p = new THREE.Vector3(position[0], position[1], position[2]);
        camera.position.copy(p);
        camera.lookAt(origin);
        
        // Rotate the camer so the galactic plane.
        //var cameraRotation = new THREE.Euler(0, 0, 45.0*Math.PI/180.0, 'XYZ');
        //var world = camera.matrixWorld;
        //var proj = camera.projectionMatrix;
        camera.up.set(0, 0, 1);
    }
    else {
        camera.position.fromArray([0, 0, STD_SCALE*OBSERVER_DISTANCE]);
        camera.lookAt(origin);
    }
    
    // The movie step is based on 16 frames per second for a five-minute pass
    // from PERSPECT*scale to the opposite PERSPECT*scale.
    MOVIE_STEP = (2*STD_SCALE*OBSERVER_DISTANCE)/(5*60*16);
    MOVIE_DIRECTION = camera.position.clone();
    MOVIE_DIRECTION.normalize();
    MOVIE_DIRECTION.multiplyScalar(-1*MOVIE_STEP);

    var renderer = rendererWrapper.newRenderer();
    renderer.setSize(sceneP.width, sceneP.height);
    container = document.getElementById(sceneP.canvasID);
    container.appendChild(renderer.domElement);

    // These effects are no longer supported in the Three.js project.  The
    // code does not work properly and there's no documentation.  Posts on
    // StackOverflow suggest that it's all been abandonded for VREffect and
    // WebVR.
    //      So for now, this is turned off.  At a later point, this will be
    // replaced with VREffect.  However, to do that requres a headset and a
    // WebVR enabled browser.
    //      In this form, the stereo effect is just a straight view forward for
    // both eyes, coupled to the device orientation controls.  There is no 3D.
    // the anaglyph effect does not work at all.
    var stereoEffect = new THREE.StereoEffect(renderer);
    //var anaglyphEffect = new THREE.AnaglyphEffect(renderer, sceneP.width, sceneP.height);
    stereoEffect.setEyeSeparation(STD_SCALE*EYE_SEPARATION);

    orbitControls = new THREE.OrbitControls( camera, renderer.domElement );
    controls = new THREE.DeviceOrientationControls( camera );
    controls.disconnect();

    //var grid = new CoordinateGrid(scale);
    // grid.joinScene(scene);
    var grid = new CylindricalGrid(scale);
    grid.joinScene(scene);

    // Save the scene.
    currentScene.camera = camera;
    currentScene.grid = grid;
    currentScene.renderer = renderer;
    currentScene.stereoEffect = stereoEffect;
    //currentScene.anaglyphEffect = anaglyphEffect;
    
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

function animate()
{
    requestAnimationFrame( animate );

    // Check for a scene with focus.
    currentScene = scenes.currentScene();
    if (undefined === currentScene) {
        return;
    }
    controls.update();

    // If movie playback is active, advance the camera position.
    if (currentScene.animation === 'movie') {
        
        // The value for step is in light-years per frame.
        var p = new THREE.Vector3(0, 0, 0);
        p.copy(camera.position);

        // When the camera reaches the scene radius, make a 180 degree turn and
        // continue.
    //    if (STD_SCALE*SCENE_RADIUS < p.length()) {
    //        MOVIE_DIRECTION = -1*MOVIE_DIRECTION;
    //    }

        // Move the camera one MOVIE_STEP.
        p = p.add(MOVIE_DIRECTION);
        camera.position.copy(p);
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
//    var wm = new THREE.Matrix4();
//    wm = camera.worldMatrix;
    
//    var renderer = currentScene.renderer;
//    var stereoEffect = currentScene.stereoEffect;
//    var anaglyphEffect = currentScene.anaglyphEffect;
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
                
                // Check that we have custom attributes.  The red and green
                // rings are point systems, but they don't have custom
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
    
    switch (currentScene.effect) {
//        case 'anaglyph':
//            var analglyphEffect = currentScene.anaglyphEffect;
//            analglyphEffect.render(scene, camera);
//            break;
        case 'stereo':
            var stereoEffect = currentScene.stereoEffect;
            stereoEffect.render(scene, camera);
            break;
        default:
            var renderer = currentScene.renderer;
            renderer.render(scene, camera);
    }
}
