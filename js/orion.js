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

// Scene geometry constants.  These distances are in inches.  The units of the
// scene is lightyears.
const SCENE_RADIUS = 36;
const OBSERVER_DISTANCE = 69;
const CAMERA_NEAR = 24;
const CAMERA_FAR = 3600; // 300 feet
const STD_SCALE = 125;
var PERSPECT = OBSERVER_DISTANCE/SCENE_RADIUS;
var CAMERA_FOV = 2*180/Math.PI*Math.asin(SCENE_RADIUS/OBSERVER_DISTANCE);

// This number is lightyears/inch.
const DIST_NORM = STD_SCALE/SCENE_RADIUS;

var container, controls, orbitControls;
//const DIST_NORM = 0.008256;

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
    var scale = sceneP.scale;

    camera = new THREE.PerspectiveCamera(
            CAMERA_FOV,
            sceneP.width/sceneP.height,
            DIST_NORM*CAMERA_NEAR,
            DIST_NORM*CAMERA_FAR);
    scene.add(camera);
    camera.position.fromArray([0, 0, PERSPECT*scale]);
    camera.lookAt(scene.position);
    
    var renderer = rendererWrapper.newRenderer();
    renderer.setSize(sceneP.width, sceneP.height);
    container = document.getElementById(sceneP.canvasID);
    container.appendChild(renderer.domElement);

    var stereoEffect = new THREE.StereoEffect(renderer);
    var anaglyphEffect = new THREE.AnaglyphEffect(renderer);
    camera.focus = PERSPECT*scale;

    orbitControls = new THREE.OrbitControls( camera, renderer.domElement );
    controls = new THREE.DeviceOrientationControls( camera );
    controls.disconnect();

    var grid = new CoordinateGrid(scale);
    grid.joinScene(scene);

    // Save the scene.
    scenes.currentScene(sceneP.canvasID).camera = camera;
    scenes.currentScene(sceneP.canvasID).renderer = renderer;
    scenes.currentScene(sceneP.canvasID).stereoEffect = stereoEffect;
    scenes.currentScene(sceneP.canvasID).anaglyphEffect = anaglyphEffect;
    
    // Update the message line.
    msgHandler.init(rendererWrapper.engine);
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
    controls.update();
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
    // TODO: The racaster object has a intersetObject method that can
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
        case 'anaglyph':
            var analglyphEffect = currentScene.anaglyphEffect;
            analglyphEffect.render(scene, camera);
            break;
        case 'stereo':
            var stereoEffect = currentScene.stereoEffect;
            stereoEffect.render(scene, camera);
            break;
        default:
            var renderer = currentScene.renderer;
            renderer.render(scene, camera);
    }
}
