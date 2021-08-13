/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
export {CylindricalGrid, CoordinateGrid};


// General Constants
//
// Useful constants used throughout the application.
const INCHES_TO_METERS = 0.0254;
const LIGHTYEARS_TO_METERS = 9460730472580800;  // exactly, defined by IAU
const PARSECS_TO_METERS = 30856775814913673;    // exactly, defined by IAU
const LIGHTYEARS_TO_PARSECS = LIGHTYEARS_TO_METERS/PARSECS_TO_METERS;
const PI2 = Math.PI * 2;


// Grid
//
// The parent class of all the grids.
var Grid = function(starScene) {
    
    this.starScene = starScene;
    this.sceneRadius = starScene.sceneRadius;
    this.scale = starScene.scale;
    
    // Build the grid.
    this.buildGrid();
};

Grid.prototype = Object.create(THREE.LineSegments.prototype);
Grid.prototype.constructor = Grid;
Grid.prototype.setGridSpacing = function(len) {
    
    // This first quantity is in light years, to display a human-friendly
    // number on the screen.  The second number is in meters, suitable for
    // calculations such the determining the movie step.
    this.gridSpacing = (len/this.scale/LIGHTYEARS_TO_PARSECS).toFixed(0);
    this.gridSeparation = len;
};
    

// CoordinateGrid
//
// A rectangular (cartesian) coordinate grid.
var CoordinateGrid = function(scene) {
    
    Grid.call(this, scene);
};
CoordinateGrid.prototype = Object.create(Grid.prototype);
CoordinateGrid.constructor = CoordinateGrid;

// Build the rectangular grid.
CoordinateGrid.prototype.buildGrid = function() {

    // This belongs in the paraent class.
    this.gridLines = new THREE.Group();
    this.gridLines.name = "coordinate grid";
    
    // The coordinate grid is made of 10x10 squares, each 1/10 of the scene
    // radius in length.
    const segLength = this.sceneRadius/5;
    this.setGridSpacing(segLength);
    
    // Galactic radials are blue.
    var xaxisMaterial = new THREE.LineBasicMaterial({
        color: 0x00d0d0,
        transparent: true,
        opacity: 0.3
    });
    // Galactic tangents are yellow.
    var zaxisMaterial = new THREE.LineBasicMaterial({
        color: 0xd0d000,
        transparent: true,
        opacity: 0.3
    });

    for (var d = -1; d <= 1; d++) {
        for (var c = -5; c <= 5; c++) {

            const xpoints = [];
            xpoints.push( new THREE.Vector3(-5*segLength, d*segLength, c*segLength) );
            xpoints.push( new THREE.Vector3(5*segLength, d*segLength, c*segLength) );
            const xgeometry = new THREE.BufferGeometry().setFromPoints(xpoints);
            const xline = new THREE.Line(xgeometry, xaxisMaterial);
            this.gridLines.add(xline);
            
            const zpoints = [];
            zpoints.push( new THREE.Vector3(c*segLength, d*segLength, -5*segLength) );
            zpoints.push( new THREE.Vector3(c*segLength, d*segLength, 5*segLength) );
            const zgeometry = new THREE.BufferGeometry().setFromPoints(zpoints);
            const zline = new THREE.Line(zgeometry, zaxisMaterial);
            this.gridLines.add(zline);
        }
    };
    
    /* Axis helper gives red x-axis, green y-axis and blue z-axis.
    const axesHelper = new THREE.AxesHelper(0.5);
    this.gridLines.add(axesHelper); */
};


// CoordinateCylidricalGrid
//
// A grid with cylindrical geometry.  The origin can be located at the center of
// the galaxy, which is the default.  Or the origin can be located at the sun,
// which cooresponds to the standard astronomical galactic coordinate system.
// 
// To specify a grid with the sun at the origin, pass 'sun' in the origin
// parameter.
var CylindricalGrid = function(scene, origin = 'galaxy') {
    
    this.origin = origin;
    Grid.call(this, scene);
};
CylindricalGrid.prototype = Object.create(Grid.prototype);
CylindricalGrid.constructor = CylindricalGrid;

// The buildGrid() function called by the parent class.
CylindricalGrid.prototype.buildGrid = function() {
    
    // The origin is the center of the galaxy and the sun is 8700 pc away at the
    // position (8700 pc, 0, 0);
    //
    // Vanhollebeke, E.; Groenewegen, M. A. T.; Girardi, L. (April 2009).
    // "Stellar populations in the Galactic bulge. Modelling the Galactic bulge
    // with TRILEGAL". Astronomy and Astrophysics. 498 (1): 95–107.
    // arXiv:0903.0946
    this.sun = new THREE.Vector3(8700*this.scene.scale, 0, 0);

    this.divisions = 32;  // in the circles of constant radius
    this.color1 = new THREE.Color(0xffff99);
    this.color2 = new THREE.Color(0x99ffff);

    this.vertices = [];
    this.colors = [];

    this.sceneRadius = this.scene.sceneRadius;
    if (this.origin === 'sun') {
        this.buildSunCentered();
    }
    else {

        // If the scene radius a little less than the distance to the center of
        // the galaxy, or even larger, then the inside radius is too small, or
        // even negative.
        if(this.scene.sceneRadius > 0.9*this.sun.x) {
            var msg = "Scene radius too large to render a galaxy centered ";
            msg = msg + "coordinate system.";
            console.log(msg);
            
            this.sceneRadius = 0.9*this.sun.x;
        }
        this.buildGalaxyCentered();
    }

    // The THREE LineSegments object.
    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',
        new THREE.Float32BufferAttribute(this.vertices, 3));
    geometry.setAttribute('color',
        new THREE.Float32BufferAttribute(this.colors, 3));

    var material = new THREE.LineBasicMaterial({
        vertexColors: THREE.VertexColors,
        transparent: true,
        opacity: 0.2
    });

    // The origin of the galaxy-centered cooridinate grid must be translated to
    // the position of the sun.
    if (this.origin === 'galaxy') {
        geometry.translate(this.sun.x, 0, 0);
    }
//    THREE.LineSegments.call(this, geometry, material);
    this.gridLines = new THREE.LineSegments(geometry, material);
};

// Build a galaxy-centered cylindrical coordinate system.  This method has the
// origin defined at the center of the galaxy, to make the math more intuitive.
// The origin must be translated to the sun before it can be added to the scene.
CylindricalGrid.prototype.buildGalaxyCentered = function() {
    
    // The scale and scene radius.
    const SCALE = this.scene.scale;
    const SCENE_RADIUS = this.sceneRadius;
    const GRID_SPACING = this.gridSpacing;
    
    var ri = this.sun.x - SCENE_RADIUS;
    var ro = this.sun.x + SCENE_RADIUS;
    var thetai = Math.PI - Math.atan(SCENE_RADIUS/this.sun.x);
    var thetaf = Math.PI + Math.atan(SCENE_RADIUS/this.sun.x);
    
    // Three Coordinate Disks
    //
    // There is one through the sun and the center of the galaxy, parallel to
    // the galactic plane, and two more a gridSpacing above and below the middle
    // one.
    for (var k = -1; k <= 1; k++) {

        // The radials
        // (Integer arithmetic works better.)
        for (var i = -10; i <= 10; i++) {

            var theta = (thetaf - thetai)/20*i + Math.PI;

            var xi = ri*Math.cos(theta);
            var yi = ri*Math.sin(theta);
            var xo = ro*Math.cos(theta);
            var yo = ro*Math.sin(theta);

            this.vertices.push(xi, yi, k*GRID_SPACING);
            this.vertices.push(xo, yo, k*GRID_SPACING);

            this.colors.push(this.color1.r, this.color1.g, this.color1.b);
            this.colors.push(this.color1.r, this.color1.g, this.color1.b);
        }

        // The circles.
        for (var i = 0; i <= 20; i++) {
            
            var r = ri + (ro - ri)/20*i;
            for (var j = -10*this.divisions; j <= 10*this.divisions; j++) {
            
                var theta1 = (thetaf - thetai)/(this.divisions*20)*j + Math.PI;
                var theta2 = (thetaf - thetai)/(this.divisions*20)*(j + 1)
                    + Math.PI;

                // First vertex.
                var x = r*Math.cos(theta1);
                var y = -r*Math.sin(theta1);
                this.vertices.push(x, y, k*GRID_SPACING);
                this.colors.push(this.color2.r, this.color2.g, this.color2.b);

                // Second vertex
                var x = r*Math.cos(theta2);
                var y = -r*Math.sin(theta2);
                this.vertices.push(x, y, k*GRID_SPACING);
                this.colors.push(this.color2.r, this.color2.g, this.color2.b);
            }
        }
    }
};
