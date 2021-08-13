/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
import {CylindricalGrid, CoordinateGrid} from './StarGrid.js';
import {StarCloud} from './Stars.js';
import {vrBoard} from './StarRenderer.js';

export {StarScene};

// General Constants
//
// Useful constants used throughout the application.
const INCHES_TO_METERS = 0.0254;
const LIGHTYEARS_TO_METERS = 9460730472580800;  // exactly, defined by IAU
const PARSECS_TO_METERS = 30856775814913673;    // exactly, defined by IAU
const LIGHTYEARS_TO_PARSECS = LIGHTYEARS_TO_METERS/PARSECS_TO_METERS;
const PI2 = Math.PI * 2;

//// THREE constants.
//const THREE_POINTS = "Points";


// SCENE GEOMETRY
// 
// The application comfortably recognizes three different levels of scale.  The
// scale of the scene must change because the interpupil distance is hard coded
// in the WebVR API.
//
// At the smallest end, the scene floats above a dining room table.  This
// scale is well suited for viewing the scene and grasping its detail from a
// position outside the scene.  It is disorienting to enter the scene, because
// everything is too close.  The whole scene is about 2 meters across, and the
// observer is about 1.5 meters from the center of the scene.
const SCENE_TABLE = 1;
// 
// At the next level up, the scene fits inside a very large room like a
// gymnasium, or even a basket ball arena.  The scale gives a revealing
// experience immersed in the stars.  The experience is satisfying and not too
// disorienting.  At this scale, the scene is about 50 meters across.  This is
// the default.
const SCENE_ARENA = 2;
// 
// At the top end, the scene is very large.  At this scale, the eye separation
// is negligible and so there are no or minimal stereoscopic effects.  This
// scale is particularly useful for viewing the constellations from the position
// of the sun so that they appear as the do in the earth's night sky.
const SCENE_CITY = 3;

// Set the parameter CHARACTER_SCALE based on one of these three choices.
function character_scale(scale_param) {

    if (scale_param === SCENE_TABLE) {
        return 1;
    }
    if (scale_param === SCENE_ARENA) {
        return 8;
    }
    if (scale_param === SCENE_CITY) {
        return 800;
    }
};


// StarScene
//
// The container is the canvas DOM element.
var StarScene = function(starMap) {

    // Parameters that define the scene.
    this.starMap = starMap;
    this.params = starMap.sceneParams;

    this.character = character_scale(SCENE_ARENA);
    if (this.params.character) {
        this.character = character_scale(this.params.character);
    };
    
    // The THREE scene.
    this.scene = new THREE.Scene();
    this.grid = null;
    
    // Properties.
    this.sceneRadius;
    this.observerDistance;
    this.scale;
    this.movieStep;
    
    // Scene Scale Parameters
    // 
    // The WebVR unit is the meter.  So it's natural to represent the scene in
    // meters.  The data from star catalogs typically gives distances in
    // kilo-parsecs.  The routines in Astro.js divides by 1000 to convert the
    // distances of the stars to parsecs.  To display the intended collection of
    // stars just above the dining room table, a scale must be introduced that
    // converts parsecs to meters.
    // 
    // The sceneRadius is the distance from the center of the scene to the edge,
    // in the virtual universe floating above the dining room table.  The units
    // of the sceneRadius are meters.  This value sets the outer limit of the
    // coordinate grids displayed in the scenes and it establishes the
    // conversion factor.
    this.sceneRadius = 36*INCHES_TO_METERS*this.character;
    this.observerDistance = 72*INCHES_TO_METERS*this.character;

    // The params object contains a scale, which is different than the scale
    // property of this object.  The params.scale is the scene radius in
    // LIGHTYEARS.  We want the scale to be in parsecs.  So the property
    // 
    //     this.scale
    // 
    // is the ratio of meters in the VR experience / parsecs in the galaxy.
    const scaleParsecs = LIGHTYEARS_TO_PARSECS*this.params.scale;
    this.scale = this.sceneRadius/scaleParsecs;
    
    // The blue and yellow coordinate grid.
    this.grid = new CoordinateGrid(this);
    this.scene.add(this.grid.gridLines);
    
    // The movie step is based on 24 frames per second.
    let pace = 10;
    if (this.params.pace) {
        pace = this.params.pace;
    };
    if (pace === 0) {
        console.warn("Pace setting of zero is not defined.");
    };
    this.movieStep = this.grid.gridSeparation/pace/24;
    this.animation = 'animate';
    
    // The star cloud.  This is a point geometry where each vertex of the
    // geometry represents a star.
    this.starCloud = new StarCloud(this);
};

StarScene.prototype.cameraSpecs = function() {

    // The near plane of the camera is always 6 inches away because that's the
    // closest an object can be and still be comfortable (for a young person)
    // to look at.
    const ret = {
        near: 6*INCHES_TO_METERS,
        far: 1080*INCHES_TO_METERS*this.character,
        fov: 2*180/Math.PI*Math.asin(this.sceneRadius/this.observerDistance)
    };
    
    return ret;
};

StarScene.prototype.getGridSpacing = function() {
    return this.grid.gridSpacing;
};

StarScene.prototype.highlightStar = function(index) {
    
    // This can be called by update before the highlightedStar geometry has neen
    // constructed.
    if (!this.starCloud.highlightStar) return;
    const highlightStar = this.starCloud.highlightStar;

    // The code device if (index) {  doesn't work here because the first element
    // of an array is the zeroth element.  So the star in the star index array
    // could never be highlighted.
    if (index !== null) {

        const star = this.starCloud.stars[index];
        if (!star) {
            console.error("Null star encountered at index " + index);
            return;
        };
        const pos = star.vertex;

        // This is necessary.  The highlighted star is a BufferGeometry with 
        // these three position attributes: pos.x, pos.y, pos.z.  The count
        // should never be greater than 3.
        //
        // Since the position attribute is changing, the needsUpdate flag
        // must be set.  Currently, setting needsUpdate does not appear to
        // have any effect.
        highlightStar.geometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute([pos.x, pos.y, pos.z], 3)
        );
        highlightStar.visible = true;
    }
    else {
        
        // No star.
        highlightStar.visible = false;
    };
};
