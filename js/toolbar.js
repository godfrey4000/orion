/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
import {renderingMap} from './Orion.js';
export {Button};


function webXRAction(button) {
    
    if (button.state === buttonOFF) {
        
        // Change the button state to ON and enter VR.
        button.state = buttonON;
        button.buttonElement.style.fill = '#bff';
        button.starMap.setStarRenderer('vr');
        return;
    }
    else {
        
        // This is just cleanup.  The WebXRManager manages the XR session.
        // When it's done, it will need to call this function just to reset the 
        // button state to OFF.
        button.state = buttonOFF;
        button.buttonElement.style.fill = '#bbb';
        button.starMap.setStarRenderer('dom');
        return;
    };
};

function movieAction(button) {

    const starScene = button.starMap.starScene;
    
    if (button.state === buttonOFF) {
        
        // Change the button state to ON and play the movie.
        button.state = buttonON;
        button.buttonElement.style.fill = '#bff';
        starScene.animation = 'movie';
    
        // Make the movie direction the direction the camera is looking.
        starScene.starMap.starRenderer.setMovieDirection();
    }
    else {
        
        // Button is on.  Change the button to OFF and stop the movie.
        button.state = buttonOFF;
        button.buttonElement.style.fill = '#bbb';
        starScene.animation = 'animate';
    };
};

function buttonAction() {
    
    // I don't like hard-coding conventions like this because it's easy to
    // forget this is here when I change the conventions in the future.
    // However, it seems that something like this is unavoidable due to the
    // callback nature of the functions listening for click events.
    if (this.id === 'vr_webvr2_toolbar') {
        webXRAction(renderingMap.vrButton);
        return;
    };
    if (this.id === 'mv_webvr2_toolbar') {
        movieAction(renderingMap.mvButton);
        return;
    };
};

// Button parent class
// 
// type should be "vr" or "mv"
// icon should be the id in the SVG file.  It's the xlink:href here.
//
const buttonOFF = 0;
const buttonON = 1;
let Button = function(type, icon, toolbarId) {
    
    // Properties.
    this.toolbarId = toolbarId;
    this.icon = icon;
    this.type = type;
    this.id = type + "_" + toolbarId;
    this.enabled = false;
    this.state = buttonOFF;
    
    // The DOM element.
    this.buttonElement = null;
};

Button.prototype.makeButton = function() {
    
    let svgclass;
    if (this.enabled) {
        svgclass = 'svgicon';
    }
    else {
        svgclass = 'svgiconDisabled';
    }
    const toolbarNode = document.getElementById(this.toolbarId);
    
    // Create the DOM elements.  The SVG icons require createElementNS.  All
    // buttons use doAction() as the onclick methhod.
    this.buttonElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.buttonElement.setAttribute('id', this.id);
    this.buttonElement.setAttribute('class', svgclass);
    this.buttonElement.setAttribute('viewBox', '0 0 100 100');
    this.buttonElement.setAttribute('width', '2em');

    // The event listener needs to be custom, so the id can be passed as a
    // parameter.
    this.buttonElement.addEventListener('click', buttonAction, false);

    // The icon itself.  This should be part of the web page that presents the
    // star scene.
    const html = "<use xlink:href='#" + this.icon + "'></use></svg>";
    this.buttonElement.innerHTML = html;
    
    // Add the button to the toolbar.
    toolbarNode.appendChild(this.buttonElement);
    
//    const html = "<svg class='" + svgclass + "'"
//        + " id='" + this.id + "'"
//        + " viewBox='0 0 10 10' width='2em'>"
//        + "<use xlink:href='#" + this.icon + "'></use></svg>";
//    this.button.innerHTML = html;
};

// acquireElement()
// 
// If the DOM element exists, save it as part of the object, so that it only
// needs to be discovered once.
// 
// NOTE: It is presumed that there is only one instance of each button type
// per canvas (canvasId).
//
Button.prototype.acquireElement = function() {
    if  (!this.elem) {
        this.elem = document.getElementById(this.id);
    };
    return this.elem;
};
