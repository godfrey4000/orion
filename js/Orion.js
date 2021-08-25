/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
import {StarMap} from '../js/StarMap.js';
export {animate, renderingMap};


// This is the starMap that has the focus.
let renderingMap;

// This is the conceptual point of entry.  Put a breakpoint here to start step-
// ing through the program at the beginning.
//
// URL parameters
//
// Many of the parameters that apply to starmaps can be passed as URL
// parameters.  If the starMap DOM element and the URL pass the same parameter,
// the URL parameter will override.  Since the URL parameters apply to the whole
// page, and since there may be more than one starmap on a page, the URL
// parameters must be applied globally, to all starmaps.  For this reason it
// should be avoided.
//
// But there are frequent uses of the starmap with just one on a page, and it is
// often convenient to change parameters such as the initial position without
// resorting to editing the HTML.
//
const url = new URL(window.location.href);
const urlParams = new URLSearchParams(url.search);

// Starmaps must follow this convention for IDs: canvas = <baseId>_canvas, etc.
// The baseId is the key for the list of starmaps.
//
function starmap_ID(idStr) {
    var baseId = idStr.substring(0, idStr.length - 7);  // remove "_canvas"
    return baseId;
};

// Starmaps are elements in the DOM with the class name "starmap".  For comp-
// atibility with the WordPress blog, the DIV element that is the canvas on
// which the scene is rendered has the starmap class name, and the other
// elements belonging to the star map are found using a convention for the
// element ID.
const starMapList = document.getElementsByClassName('starMap');
const starMaps = new Map();
for (let i = 0; i < starMapList.length; i++) {

    console.log('Canvas found: ' + starMapList[i].id);
    try {
        // Certain parameters (noteably the source file containing the stars)
        // must be specified in the star map in the HTML.
        const mapParams = starMapList[i].dataset.mapParams;
        const dom_parameters = JSON.parse(mapParams);
        
        // Gather the elements of each starmap, that is the toolbar, grid panel,
        // messages panel and the canvas itself.
        const idStr = starMapList[i].id;
        const baseId = starmap_ID(idStr);
        const elems = {};
        elems.id = baseId;
        elems.canvasId = baseId + "_canvas";
        elems.toolbarId = baseId + "_toolbar";
        elems.panelGridId = baseId + "_grid";
        elems.panelMessagesId = baseId + "_messages";
        
        // Determine the width and height of the canvas where the stars will be
        // rendered.
        //
        // Best is to set the size with HTML/CSS so that it displays equally
        // well on a smartphone, tablet, desktop.
        //
        // Yes, the width and the height are both set the clientWidth.  There's
        // apparently no way to set the height of td element so that you get a
        // square (no way I could find at least after a couple of hours of
        // googling).  2 pixels are subtracted to accommodate the border of one
        // pixel that surrounds canvas element.
        //
        // TODO: There HAS to be a better way.
        //
        const canvas = document.getElementById(elems.canvasId);
        dom_parameters.width = canvas.clientWidth - 2;
        dom_parameters.height = canvas.clientWidth - 2;

        //  Then create a new starmap and add it to the starmaps being managed.
        renderingMap = new StarMap(elems);

        // Additional parameters may be present in the URL.  But urlParams is an
        // object, not an array.  It has to be used like an iterator.  It's the
        // only way I can get it to work.
        renderingMap.setSceneParams(dom_parameters, urlParams);
        starMaps.set(baseId, renderingMap);

        // Add a mouseover and mouseout event listener so that the render
        // operation is only called when the mouse is in the element that
        // holds the star map.
//        renderingMap.canvas.addEventListener("mouseover", function() {
//            onMouseOver(this);
//        });
//        renderingMap.canvas.addEventListener("mouseout", function() {
//            onMouseOut(this);
//        });
    }
    catch (err) {
        console.error(err.message);
    }
};

// The starmap will render (update the display) when it has focus.
function onMouseOver(elem) {
    var baseId = starmap_ID(elem.id);
    renderingMap = starMaps.get(baseId);
};
function onMouseOut(elem) {
    renderingMap = null;
};

// Ask each starmap to initialize.  The starmaps will download the star
// datafile and then create the initial view of the stars in the datafile.
for (var [key, starMap] of starMaps) {
    
    // Establish the geometry of the scene, including the camera, the spaceship,
    // the grid and the scale.  Then render it, so that it's visible even when
    // there is a problem fetching and rendering the stars.
    starMap.init();
    
    // Add the renderers and give them the animation loop.  Then render, so I
    // can watch the progress of building scene when I'm debugging.
    const starRenderer = starMap.addRenderer(animate);
    starRenderer.renderOnce();
    
    // Fetch the stars from the online star file and render those.  There is no
    // point in rendering the scene after this call because it asynchronously
    // calls a function to retrieve a CSV with all the star data over the
    // internet.
    // 
    // Could this be done asynchronously?
    starMap.fetchStars();

    // The Scene is now complete.
//    starRenderer.renderer.setAnimationLoop(animate);
    starMap.displayDefaultMessage();
};


function animate()
{
    if (!renderingMap) {
        
        // No starMap has the focus.  Nothing to do.
        return;
    };

//    // Check for a scene with focus.
//    const currentScene = sm.starScene.scene;
//    if (undefined === currentScene) {
//        return;
//    }
    const starScene = renderingMap.starScene;
    const starRenderer = renderingMap.starRenderer;
    
    starRenderer.update();
    
    // And then render the scene.
    starRenderer.renderer.render(starScene.scene, starRenderer.camera);
};
