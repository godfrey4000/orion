/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */

import {StarScene} from './StarScene.js';
import {Button} from './toolbar.js';
import {DOMRenderer, VRRenderer} from './StarRenderer.js';
import {toGal} from './astro.js';
export {StarMap};

// The sun.
const SUN_POS = {u: 0.0, v: 0.0, w: 0.0};
const SUN = [{
    position: SUN_POS,
    magnitude: 4.83,
    spectrum: "G",
    tagged: false,
    habitable: false,
    life: true,
    attribute: "Sun"
}];


// StarMap
//
// A StarMap is the collection consisting of the canvas on which the stars are
// rendered, a toolbar with buttons to start/stop camera motion and enter VR, a
// panel to display information about the scale and grid size, and a panel to
// display messages.  On a web page, these elements are organized into a
// rectangle that appears as a application window.
// 
// In the past, generally, there could be more than one on a web page.  These
// doesn't seem to be necessary anymore.
//
// Typically, the web page is layed out before any of the JavaScript is run.
// So the IDs of these elements are created at design time by the web page
// designer.  These IDs must be passed to the StarMap instance, and they take
// this form:
//
//     <id>_canvas         - the document ID of the canvas
//     <id>_toolbar        - the document ID of the toolbar
//     <id>_grid           - the document ID of the panel providing grid info
//     <id>_messages       - the document ID of the panel for messages
//
// These four IDs are passed as object.  The form of the object is
// 
//     obj.canvasId: <id>_canvas
//     obj.toolbarId: <id>_toolbar
//     obj.panelGridId: <id>_grid
//     obj.panelMessagesId: <id>_messages
//
let StarMap = function(starmapElements) {
    
    // The elements of a starmap
    this.id = starmapElements.id;
    this.canvasId = starmapElements.canvasId;
    this.toolbarId = starmapElements.toolbarId;
    this.panelGridId = starmapElements.panelGridId;
    this.panelMessagesId = starmapElements.panelMessagesId;
    
    this.canvas = document.getElementById(this.canvasId);
    if (this.canvas === null) {
        console.log("Canvas for ID=" + this.id + " not found.");
    }
    this.toolbar = document.getElementById(this.toolbarId);
    if (this.toolbar === null) {
        console.log("Toolbar for ID=" + this.id + " not found.");
    }
    this.panelGrid = document.getElementById(this.panelGridId);
    if (this.panelGrid === null) {
        console.log("Grid panel for ID=" + this.id + " not found.");
    }
    this.panelMessages
        = document.getElementById(this.panelMessagesId);
    if (this.panelMessages === null) {
        console.log("Messages panel for ID=" + this.id + " not found.");
    }

    // Properties
    this.starScene;      // the WebGL scene
    this.sceneParams;    // the map parameters (scale, data file, etc.
    
    // These are the DOM elements themselves.  They need an addEventListener
    // implemented like this:
    //
    //    this.vrButton.addEventListener('click', function, false);
    //
    this.vrButton = new Button('vr', 'icon-cardboard', this.toolbarId);
    this.mvButton = new Button('mv', 'icon-play', this.toolbarId);
    
    // Contents of the messages panel.
    this.messageText = "";  // realy needed?
};

// Parameters
// 
// These are the parameters that can be passed to the star map.
//
//     scale:       the characteristic radius of the scene (light years)
//     source:      href giving the location of the star CSV file
//     /* These MUST be specified.  There are no default.
//     
//     width:       width of the map rendering element (pixels)
//     height:      height of the map rendering element (pixels)
//     /* Defaults to the window.inner.width and window.inner.height.
//     
//     sun:         include the sun at the origin (true/false)
//     /* Default if false.
//     
//     position:    the initial position of the camera
//     direction:   the initial direction of the camera
//     /* These are {x:, y:, z: } objects in meters, the unit of the WebGL VR
//        space.  The direction must be normalized.
//        
//     character:   SCENE_TABLE = 1, SCENE_ARENA = 2, SCENE_CITY = 3
//     /* Default is SCENE_ARENA.
//     
//     pace:        seconds per gridline (scale/5)
//     /* Default 10 seconds (pretty fast).
//     
StarMap.prototype.setSceneParams = function(paramsDOM, paramsURL) {
    
    this.sceneParams = paramsDOM;
    
    // The params passed through the URL override.
    if (paramsURL) {
        for (const param in paramsURL) {
            this.sceneParams[param] = paramsURL[param];
        };
    };
    
    // If the position is in the parameters, convert it to an object like
    // {x: y: z: } from an array like [x,y,z].
    if (this.sceneParams.position) {
       const pos = {
           x: this.sceneParams.position[0],
           y: this.sceneParams.position[1],
           z: this.sceneParams.position[2]
       };
       this.sceneParams.position = pos;
    };
};

// msg()
//
// If the method is called without an argument, the existing message is
// returned.  An empty string is returned if there is no message.
//
// If the method is called with an argument, the argument replaces the content
// of the messages panel, and the new message is returned.
//
StarMap.prototype.msg = function(msg) {

    // When debugging on another device, this is often the only way to see what
    // is going on.
    // alert(msg);

    this.messageText = msg;
    this.panelMessages.innerHTML = this.messageText;
    return this.messageText;
};

StarMap.prototype.clearMsg = function() {
    
    // If the error flag is set, the message can't be cleared.
    if (!this.haveError || this.haveError === false) {
        this.msg("");
    }
};

StarMap.prototype.errorMsg = function(msg) {
    
    // Same as a normal message, but sets the error flag.
    this.haveError = true;
    this.msg(msg);
};

StarMap.prototype.setGridSpacing = function(gspace) {
    
//    var gridSpacing = new AstroUnit(gspace, UNIT_PARSEC);
    const msg = "Grid Spacing: " + gspace;
    this.panelGrid.innerHTML = msg;
};

StarMap.prototype.initToolbarButtons = function() {
    
    // If WebXR isn't supported, then disable the vr button.
//    if (this.starScene.webXR.webXRSupported) {
//        this.vrButton.enabled = true;
//    }
    this.vrButton.enabled = true;
    this.mvButton.enabled = true;
    
    // Make the buttons active.  They will need the starScene to do their work.
    this.vrButton.starMap = this;
    this.mvButton.starMap = this;
    this.vrButton.makeButton();
    this.mvButton.makeButton();
};

StarMap.prototype.displayDefaultMessage = function() {
    
    // Display the title if we have that.
    if ('title' in this.sceneParams) {
        this.msg(this.sceneParams['title']);
        return;
    };
    
    // Otherwise the number of stars.
    if (this.numberStars) {
        
        // Display the number of stars.
        const msg = "Stars: " + this.numberStars.toString();
        this.msg(msg);
        return;
    };
};

// init()
//
// Create a new scene object.  This method will initialize, which downloads the
// stars and builds the scene.
//
StarMap.prototype.init = function() {
    
    if (!this.sceneParams) {
        const msg = "Cannot init starmap " + this.id + ". No parameters.";
        console.log(msg);
        
        this.errorMsg("No scene parameters.");
        return;
    }
    
    // The starScene is the THREE.js scene that contains the geometries,
    // materials, camera, etc. that build the field of stars and the coordinate
    // grids.  This.params has everything the StarScene object needs to know
    // how to build the THREE.js scene and star field.
    // 
    // starScene has the WebXR manager, so it must be created first.  The WebXR
    // manager has a check to see if it's supported.
    this.msg("Initializing scene...");
    this.starScene = new StarScene(this);
    
    const gridSpacing = this.starScene.getGridSpacing();
    this.setGridSpacing(gridSpacing);
    
//    // Make the VR and move buttons visible in the toolbar.
    this.initToolbarButtons();
//    this.clearMsg();
};

// fetchStars()
//
// Retrieves the stars from an online file containing a list of stars and then
// calls the StarScene's ... method to add them to the scene.
StarMap.prototype.fetchStars = function() {
    
    this.msg("Loading star data...");
    const self = this;
    
    const starCloud = this.starScene.starCloud;
                
    // Add the sun if requested
    if (this.sceneParams.sun) {
        starCloud.addStars(SUN);
    };

    try {
        d3.csv(this.sceneParams.source, function(error, parsedData) {

            // Don't know the contents of the error.  And sometimes (my tablet),
            // the status code is zero.  Haven't been able to find a document
            // that says what that means, but the status codes seem to map to
            // HTTP response codes.  If that's the case, then a status code of
            // zero suggests everything is OK.
            //
            // However, this can't be right.  If the d3 library is able to
            // retrieve and parse the data, no error object is null.  In either
            // case, either error is null (we have pased data) or parsedData is
            // null (we don't have parsed data).
            //
            // Update: It seems that HTTPS issues produce the case where d3
            // retrieve fails, but the status is 0.  For example, mixing HTTP
            // and HTTPS reproduces this case.
            //
            let err = 0;
            let haveError = false;
            let errorMessage;
            if (error) {
                if (!parsedData && error.currentTarget.status > 0) {
                    
                    // Didn't work and the status can be trusted to explain why.
                    haveError = true;
                    err = error.currentTarget.status;
                    errorMessage = "Failed to retrieve stars (" + err + ").";
                };
                if (!parsedData && error.currentTarget.status === 0) {
                    
                    // Didn't work, and there's no explanation.  This is hap-
                    // pening, which is why I'm doing so much work here.
                    haveError = true;
                    err = 0;
                    errorMessage = "Failed to retrieve stars. Why?";
                };
                console.error(errorMessage);
                self.errorMsg(errorMessage);
            };
            
            if (!haveError) {

                // No error.  Proceed to process the star data.
                const starData = toGal(parsedData);
                self.numberStars = starData.length;
                starCloud.addStars(starData);
                starCloud.renderStars()

                // Display the number of stars on the message pannel or the 
                // default message.  NOTE: this is asynchronous, so it's likely
                // the last call to the starMap.msg().
                self.displayDefaultMessage();
            }
        });
    }
    catch (err) {
        self.errorMsg(err.message);
        console.log(err.message);
    };
};

StarMap.prototype.setStarRenderer = function(choice) {
    
    if (choice === 'dom') {
        this.vrRenderer.canvasOFF();
        this.vrRenderer.renderer.setAnimationLoop(null);  // Necessary?
        
        this.domRenderer.canvasON();
        this.domRenderer.renderer.setAnimationLoop(this.animationLoop);
        this.starRenderer = this.domRenderer;
        return this.starRenderer;
    };

    if (choice === 'vr') {
        this.domRenderer.canvasOFF();
        this.domRenderer.renderer.setAnimationLoop(null);  // Necessary?
        
        this.vrRenderer.canvasON();
        this.vrRenderer.renderer.setAnimationLoop(this.animationLoop);
        this.starRenderer = this.vrRenderer;
        return this.starRenderer;
    };
};

StarMap.prototype.addRenderer = function(animate) {
    
    // Save this animation loop.
    this.animationLoop = animate;
    
    // The DOM renderer is the 2D renderer and the VR renderer is the 3D
    // renderer.  Both are created independently, since they seem to be in-
    // compatible.  They both have (hopefully) independent cameras.
    //
    // DOM Renderer (2D)
    // The orbit controls change the camera's position.
    //
    // VR Renderer (3D)
    // The gyro controls of the smartphone orient the camera and a second con-
    // troller selects objects based on the camera direction.
    //
    this.domRenderer = new DOMRenderer(this.starScene);
    this.vrRenderer = new VRRenderer(this.starScene);

    // The DOM renderer is the active renderer to start.
    return this.setStarRenderer('dom');
};
