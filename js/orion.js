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

// This was in the original template.  It's used in the animate()
// function.
//var clock = new THREE.Clock();

// For some undetermined reason, only the last scene renders when it's
// Firefox, Linux and WebGL.  This only happens with the renderOnce function
// when it is called right after adding the stars to the scene.  Works fine
// stepping through in debug mode.  To squash (not solve) this problem, the
// scenes are cycled and rendered this many times:
//const INIT_CYCLE_SCENES = 10;
//var SCENE_CYCLES = 0;

// Objects for identifying the star under the mouse pointer and displaying
// the attribute.  The units of the threshold are world units, which are
// independent of scale.
var raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 1.5;
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
animate();


/*
 * draw()
 *
 * Draws the scene from the star map data.
 */
function draw(mapData)
{
    // The message line handler for the current scene.
    var msgHandler = scenes.currentScene().msgHandler;
    
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
        var starData = toGal(csv);
        msg.setNumberStars(starData.length);
        addStars(starData, mapData);
        renderOnce(scene);
        console.info("Rendered scene for " + mapData.canvasID);
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
    // The scene
    var scene = scenes.currentScene().scene;
    var msgHandler = scenes.currentScene().msgHandler;

    /* The camera
     * Tried an orthographic camera, but the sense of depth was lost, so
     * that was rejected.
     */
    var VIEW_ANGLE = 45, ASPECT = sceneP.width/sceneP.height, NEAR = 2, FAR = sceneP.scale*50;
    var camera = new THREE.PerspectiveCamera( VIEW_ANGLE, ASPECT, NEAR, FAR);
    scene.add(camera);
    camera.position.fromArray(sceneP.position);
    camera.lookAt(scene.position);

    // The renderer
    var renderer = rendererWrapper.newRenderer();
    renderer.setSize(sceneP.width, sceneP.height);
    var container = document.getElementById(sceneP.canvasID);
    container.appendChild(renderer.domElement);

    // The controls
    var controls = new THREE.OrbitControls( camera, renderer.domElement );

/**
 * The Skybox does not appear to be required anymore.
 *
    // The Skybox
    //
    // The skyBox geometry appears to be required to set the background
    // to black.  The suggestion:
    //     scene.background = new THREE.Color( 0x000000 );
    // doesn't seem to have any effect.
    var skyBoxGeometry = new THREE.CubeGeometry( sceneP.scale*50, sceneP.scale*50, sceneP.scale*50 );
    var skyBoxMaterial = new THREE.MeshBasicMaterial({
        color: 0x000000,
        side: THREE.BackSide,

        // CanvasRenderer shows lines between mesh
        // polygons without this.
        overdraw: 0.5
    });
    var skyBox = new THREE.Mesh( skyBoxGeometry, skyBoxMaterial );
    scene.add(skyBox);
*/

    // The coordinate grid
    grid = new CoordinateGrid(sceneP.scale);
    grid.joinScene(scene);

    // Save the scene.
    scenes.currentScene().camera = camera;
    scenes.currentScene().renderer = renderer;
    
    // Update the message line below the star map.
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
    scenes.currentScene().msgHandler.reset();
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
    render();
//    update();
};

//function update()
//{
//    var dt = clock.getDelta();
//};

function render()
{
    /*
     * It appears that the renderer calls the rendering function
     * at regular intervals.  Both render functions can't be called
     * at those times (i.e.
     *     for (i = 0; i < scenesJS.length; i++) {
     *         scenesJS[i].renderer.render()
     *         ...
     *     }
     * ).  It seams as though the thread that's building the scenes
     * crashes and nothing further gets added to the scene.
     *
     * The solution here, perhaps kludgy, is to split the calls
     * between the scenes on the page.  A better approach might be
     * to do the render function on the container that has focus.
     *
     * NOTE:  The drawbacks with this approach is that the frame
     * rates for the scenes are twice as slow, and it is constantly
     * switching the currentSource, which could play havoc with
     * other processes.
     */
    
    // Check for a scene with focus.
    currentScene = scenes.currentScene();
    if (undefined === currentScene) {
        return;
    }
    var scene = currentScene.scene;
    var camera = currentScene.camera;
    var renderer = currentScene.renderer;
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

                // Dig the attribute out of the object.  This should probably be
                // handled better.
                var index = intersects[k].index;
                var attr = obj.geometry.custAttributes[index];
                if (attr !== undefined && attr.length > 0) {
                    msgHandler.setAttribute(attr);
                }
            }
        }
    }
    
    renderer.render( scene, camera );
};

function renderOnce(currentScene) {
    
    var scene = currentScene.scene;
    var camera = currentScene.camera;
    var renderer = currentScene.renderer;
    
    renderer.render(scene, camera);
}