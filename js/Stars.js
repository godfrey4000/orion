export {StarCloud}

// Images
const STAR_IMG = 'images/disc.png';
const RING_IMG = 'images/ring.png';

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
const HIGHLIGHT = 8;

// Star size profiles
const STARSCHEME_POINTS = {
    veryDim: 2,
    dim: 3,
    mediumBright: 4,
    bright: 5,
    veryBright: 6,
    ring: 8
};
const STARSCHEME_SMALL = {
    veryDim: 3,
    dim: 4,
    mediumBright: 5,
    bright: 6,
    veryBright: 8,
    ring: 12
};

// Star bightness profiles
//
// Suitable for Gaia queries, within a few 100 ly.
const STAR_BRIGHTNESS_GAIA_LOCAL = {
    dim: 14.4,
    mediumBright: 8.4,
    bright: 4.55,
    veryBright: 2
};

// Absolute magnitude breakpoints.
// Suitable for galaxy-level (scale ~ 2000 pc)
const STAR_BRIGHTNESS_GALAXY = {
    dim: 3,
    mediumBright: 2,
    bright: 1,
    veryBright: 0
};

// Suitable for only dim stars.
const STAR_BRIGHTNESS_DIM = {
    dim: 18,
    mediumBright: 17,
    bright: 16,
    veryBright: 15
};

// Broad range of magnitudes
const STAR_BRIGHTNESS_BROAD = {
    dim: 16,
    mediumBright: 12,
    bright: 8,
    veryBright: 4
};

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
const loaderManager = new THREE.LoadingManager(
        onTextureLoad, onTextureProgress, onTextureFail
);
function onTextureLoad() {

    // scenes.doWithAll(renderOnce);
    return;
};
function onTextureProgress(arg1, arg2, arg3) {};
function onTextureFail() {
    console.error("Failed to load a texture.");
};


// MaterialManager
//
// This class encapsulates the materials for stars and ring markers.  It serves
// the addStars() and addSun() functions so those functions do not need to know
// if the renderer is WEBGL or CANVAS.
var MaterialManager = function(starscheme) {
    
    var mapStar = new THREE.TextureLoader(loaderManager).load(STAR_IMG);
    var mapRing = new THREE.TextureLoader(loaderManager).load(RING_IMG);

    // These materials are for point systems, which use the WEBGL renderer.
    // They are all identical, except the size.  And they all have
    // vertexColors set to THREE.VertexColors, so that the color of the image
    // is set individually by star.
    //
    // Very dim stars.
    this.materialVeryDim = new THREE.PointsMaterial({
      size: 0.6,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapStar,
      color: 0x070707,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 10
    });
    this.materialVeryDim.name = 'dim color';
    
    // Dim stars.
    this.materialDim = new THREE.PointsMaterial({
      size: 1.0,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapStar,
      color: 0x454545,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 10
    });
    this.materialDim.name = 'dim color';
    
    // Medium-bright stars.
    this.materialMedium = new THREE.PointsMaterial({
      size: 1.4,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapStar,
      color: 0x838383,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 10
     });
     this.materialDim.name = 'medium color';
    
    // Bright stars.
    this.materialBright = new THREE.PointsMaterial({
      size: 1.8,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapStar,
      color: 0xc1c1c1,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 10
    });
    this.materialBright.name = 'bright color';

    // Very bright stars.
    this.materialVeryBright = new THREE.PointsMaterial({
      size: 2.2,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapStar,
      color: 0xffffff,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 10
    });
    this.materialVeryBright.name = 'very bright color';

    // A ring for marking stars.
    this.materialRingMark = new THREE.PointsMaterial({
      size: 8,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapRing,
      color: 0xff0000,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 1.5
    });
    this.materialRingMark.name = 'red ring';

    // A ring for marking the sun, and any stars with a planet known to
    // harbor life.
    this.materialRingLife = new THREE.PointsMaterial({
      size: 8,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapRing,
      color: 0x00ff00,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 0.75
    });
    this.materialRingLife.name = 'green ring';

    // A ring for marking the stars that have confirmed exoplanets in the
    // habitable zone.  The color is blue.
    this.materialRingHabitable = new THREE.PointsMaterial({
      size: 8,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapRing,
      color: 0x0077ff,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 2
    });
    this.materialRingHabitable.name = 'blue ring';

    // Finally, a ring to mark the star whose attribute is displated in VR.
    this.materialHighlight = new THREE.PointsMaterial({
      size: 8,
      sizeAttenuation: SIZE_ATTENUATION,
      map: mapRing,
      color: 0xffff77,
      blending: THREE.AdditiveBlending,
      transparent: TRANSPARENT,
      opacity: 1.2
    });
    this.materialHighlight.name = 'yellow ring';
};

MaterialManager.prototype.material = function(starClass) {

    // The starClass will be one of these constants:
    //   VERYDIM_STAR
    //   DIM_STAR
    //   MEDIUM_STAR
    //   BRIGHT_STAR
    //   VERYBRIGHT_STAR
    //   MARK_RING
    //   LIFE_RING

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
    case HIGHLIGHT:
        return this.materialHighlight;
        break;
    };
};


// StarClass
//
class StarClass {
    constructor (magnitude, marked = false, habitable = false, life = false) {

        const brightness = STAR_BRIGHTNESS_GAIA_LOCAL;
        this.classification = undefined;

        if (magnitude < brightness.veryBright) {
            this.classification = VERYBRIGHT_STAR;
        }
        else if (magnitude < brightness.bright) {
            this.classification = BRIGHT_STAR;
        }
        else if (magnitude < brightness.mediumBright) {
            this.classification = MEDIUM_STAR;
        }
        else if (magnitude < brightness.dim) {
            this.classification = DIM_STAR;
        }
        else {
            this.classification = VERYDIM_STAR;
        }
        this.marked = marked;
        this.life = life;
        this.habitable = habitable;
    };
};


// Star
//
class Star {
    constructor (position, magnitude, spectrum, temperature, luminosity, attr,
        marked = false,
        habitable = false,
        life = false) {

        // This constructor receives the positions of the star in a u,v,w
        // galactic coordinate system where
        //     u -- points to galactic center
        //     v -- points to galactic east (opposite rotation)
        //     w -- points to the galactic north pole.
        // 
        // The orbit controls have hard-coded the y-axis as the polar axis and
        // the x-axis as the azimuthal axis.  So to starmap will rotate
        // naturally if we follow this mapping:
        //     x -> -u
        //     y -> w
        //     z -> v
        this.vertex = {x: -position.u, y: position.w, z: position.v};
        this.starClass = new StarClass(magnitude, marked, habitable, life);

        // A color scheme exists for the stars.  However, the point cloud object
        // in Three.js has changed, breaking the original implementation that
        // assigns an individual color to each star.
        //
        // For the time being, all the stars are white.
        this.temperature = temperature;
        this.luminocity = luminosity;
        this.magnitude = magnitude;
        this.spectrum = spectrum;
        this.attribute = attr;
        
        // This is for consistency.  The properties of the star can be accessed
        // as properties.
        this.spectralClass = this.setSpectralClass();
//        this.color = this.setColor();
    };
    
    info() {
        
        return this.attribute;

//        // Some nicely formatted text describing the star -- no more than can
//        // fit on a short line.
//        let description;
//        description = this.attribute;
//        if (this.spectrum) {
//            description = description + " " + this.spectrum;
//        };
//        if (this.magnitude) {
//            description = description + " "  + this.magnitude.toFixed(1);
//        };
//        return description;
   };

    setSpectralClass() {
    
        if (this.spectrum !== undefined) {
            return this.spectrum;
        };
        if (this.temperature === undefined) {
            return "";
        }
        else {
            if (this.temperature > 25000.0) {
                return "O";
            };
            if (this.temperature > 10000.0) {
                return "B";
            };
            if (this.temperature > 7500.0) {
                return "A";
            };
            if (this.temperature > 6000.0) {
                return "F";
            };
            if (this.temperature > 5000.0) {
                return "G";
            };
            if (this.temperature > 3500.0) {
                return "K";
            };
            if (this.temperature <= 3500.0) {
                return "M";
            };
        };
    };

/*    setColor() {

        var color = new THREE.Color();
        var spectralClass = this.spectralClass();
        color.set(this.colorScheme.color(spectralClass));
        var hslColor = new THREE.Color();
        color.getHSL(hslColor);
        var hue = hslColor.h;

        // Adjust the saturation and value based on the brightness of the star.
        if (this.starClass.class === VERYDIM_STAR) {
            color.setHSL(hue, 0, 0.60);
            return color;
        }
        if (this.starClass.class === DIM_STAR) {
            color.setHSL(hue, 0.15, 0.80);
            return color;
        }
        if (this.starClass.class === MEDIUM_STAR) {
            color.setHSL(hue, 0.30, 0.90);
            return color;
        }
        if (this.starClass.class === BRIGHT_STAR) {
            color.setHSL(hue, 0.45, 0.95);
            return color;
        }
        if (this.starClass.class === VERYBRIGHT_STAR) {
            color.setHSL(hue, 0.60, 0.98);
            return color;
        }
        return color;
    }; */
};


// StarCloud
// 
// This class is the Three.js point cloud with an array of all the stars.  The
// array of stars is included so that properties like the attribute can be
// accessed with an index.
class StarCloud {
    constructor(starScene) {
    
        this.starScene = starScene;

        // The array of stars and an index.
        this.stars = [];
        this.starLookup = [];

        // The star material hold the information for drawing the size and color
        // of the points to represent brightness.
        this.starMaterial = new MaterialManager(STARSCHEME_POINTS);
    
        // The THREE object.  This is added to the THREE scene.
        this.starCloud = new THREE.Group();
        this.starCloud.name = 'star cloud';

        // The yellow highlight ring.  It's at the origin now, and not visible
        // to start.

        // The THREE object starCloud is an assemply of the following point
        // clouds organized by their brightness (absolute magnitude ultimately),
        // along with rings for identifying certain stars.
        //
        // For identifying and marking stars during the VR.
        this.highlightStar = undefined;
        this.starCloudIndex = undefined;

        // Stars
        this.veryDimStars = undefined;
        this.dimStars = undefined;
        this.mediumStars = undefined;
        this.brightStars = undefined;
        this.veryBrightStars = undefined;

        // Rings for marking stars.
        this.markedStars = undefined;
        this.lifeStars = undefined;
        this.habitableStars = undefined;
    };

    addStars(starData) {
        
        // This is a work-around for something.  I can't remember what.
        var self = this;

        starData.forEach(function(d) {

            var star = new Star(d.position, d.magnitude, d.spectrum,
                d.temperature, d.luminosity, d.attribute,
                d.tagged, d.habitable, d.life);
            self.stars.push(star);
        });
    };
    
    renderStars() {

        // The yellow highlight ring.  It's at the origin now, and not visible to
        // start.
        const highlightGeometry = new THREE.BufferGeometry();
        this.highlightStar = new THREE.Points(
                highlightGeometry,
                this.starMaterial.material(HIGHLIGHT));
        this.highlightStar.visible = false;
        this.highlightStar.frustumCulled = false;  // So the yellow circles always show up.

        // This is the index for searching with the raycaster.
        const idxGeometry = new THREE.BufferGeometry();
        this.starCloudIndex = new THREE.Points(
                idxGeometry,
                this.starMaterial.material(MEDIUM_STAR));
        const idxVertices = [];

        // The stars.
        const veryDimGeometry = new THREE.BufferGeometry();
        const veryDimStars = new THREE.Points(
                veryDimGeometry,
                this.starMaterial.material(VERYDIM_STAR));
        veryDimStars.name = 'very dim stars';
        const veryDimVertices = [];

        const dimGeometry = new THREE.BufferGeometry();
        const dimStars = new THREE.Points(
                dimGeometry,
                this.starMaterial.material(DIM_STAR));
        dimStars.name = 'dim stars';
        const dimVertices = [];

        const mediumGeometry = new THREE.BufferGeometry();
        const mediumStars = new THREE.Points(
                mediumGeometry,
                this.starMaterial.material(MEDIUM_STAR));
        mediumStars.name = 'medium bright stars';
        const mediumVertices = [];

        var brightGeometry = new THREE.BufferGeometry();
        const brightStars = new THREE.Points(
                brightGeometry,
                this.starMaterial.material(BRIGHT_STAR));
        brightStars.name = 'bright stars';
        const brightVertices = [];

        const veryBrightGeometry = new THREE.BufferGeometry();
        const veryBrightStars = new THREE.Points(
                veryBrightGeometry,
                this.starMaterial.material(VERYBRIGHT_STAR));
        veryBrightStars.name = 'very bright stars';
        const veryBrightVertices = [];

        // The rings that mark stars.
        const markedGeometry = new THREE.BufferGeometry();
        const markedStars = new THREE.Points(
                markedGeometry,
                this.starMaterial.material(MARK_RING));
        markedStars.name = 'marked stars';
        const markedVertices = [];

        const lifeGeometry = new THREE.BufferGeometry();
        const lifeStars = new THREE.Points(
                lifeGeometry,
                this.starMaterial.material(LIFE_RING));
        lifeStars.name = 'life stars';
        const lifeVertices = [];

        const habitableGeometry = new THREE.BufferGeometry();
        const habitableStars = new THREE.Points(
                habitableGeometry,
                this.starMaterial.material(HABITABLE_RING));
        habitableStars.name = 'habitable stars';
        const habitableVertices = [];

        let star;
        let starClass;
    
        // Convert to the star scene's scale (in meters).
        for (let j = 0; j < this.stars.length; j++) {

            star = this.stars[j];
            
            // The stars loaded from the CSV star data file have coordinates
            // measured in parsecs.  This scales them to the scene, in meters.
            // the scale value is meters/parsecs.
            star.vertex = {
                x: this.starScene.scale*star.vertex.x,
                y: this.starScene.scale*star.vertex.y,
                z: this.starScene.scale*star.vertex.z};
            starClass = star.starClass;

            // Keep track of the stars with an attribute.  These are the stars
            // that we want to find with the raycaster.
            if (star.attribute) {
                this.starLookup.push(j);
                idxVertices.push(star.vertex.x, star.vertex.y, star.vertex.z);
            }

            if (starClass.marked) {
                markedVertices.push(star.vertex.x, star.vertex.y, star.vertex.z);
            }
            if (starClass.life) {
                lifeVertices.push(star.vertex.x, star.vertex.y, star.vertex.z);
            }
            if (starClass.habitable) {
                habitableVertices.push(star.vertex.x, star.vertex.y, star.vertex.z);
            }
            if (starClass.classification === VERYDIM_STAR) {
                veryDimVertices.push(star.vertex.x, star.vertex.y, star.vertex.z);
            }
            if (starClass.classification === DIM_STAR) {
                dimVertices.push(star.vertex.x, star.vertex.y, star.vertex.z);
            }
            if (starClass.classification === MEDIUM_STAR) {
                mediumVertices.push(star.vertex.x, star.vertex.y, star.vertex.z);
            }
            if (starClass.classification === BRIGHT_STAR) {
                brightVertices.push(star.vertex.x, star.vertex.y, star.vertex.z);
            }
            if (starClass.classification === VERYBRIGHT_STAR) {
                veryBrightVertices.push(star.vertex.x, star.vertex.y, star.vertex.z);
            }
        };

        idxGeometry.setAttribute('position', new THREE.Float32BufferAttribute(idxVertices, 3));
        highlightGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
//        highlightGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0.040405, -0.0225353, -0.042579], 3));

        // Add the star positions.  These are the vertices.
        veryDimGeometry.setAttribute('position', new THREE.Float32BufferAttribute(veryDimVertices, 3));
        dimGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dimVertices, 3));
        mediumGeometry.setAttribute('position', new THREE.Float32BufferAttribute(mediumVertices, 3));
        brightGeometry.setAttribute('position', new THREE.Float32BufferAttribute(brightVertices, 3));
        veryBrightGeometry.setAttribute('position', new THREE.Float32BufferAttribute(veryBrightVertices, 3));

        markedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(markedVertices, 3));
        lifeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lifeVertices, 3));
        habitableGeometry.setAttribute('position', new THREE.Float32BufferAttribute(habitableVertices, 3));

        // Computing the bounding sphere for each star clound increases the
        // performance of searches with the raycaster -- I suspect.
        veryDimGeometry.computeBoundingSphere();
        dimGeometry.computeBoundingSphere();
        mediumGeometry.computeBoundingSphere();
        brightGeometry.computeBoundingSphere();
        veryBrightGeometry.computeBoundingSphere();

        // Update the particle system to sort the particles, which enables the
        // behavior we want.  (What behavior is this?)
        this.starCloudIndex.sortParticles = true;

        markedStars.sortParticles = true;
        lifeStars.sortParticles = true;
        habitableStars.sortParticles = true;
        veryDimStars.sortParticles = true;
        dimStars.sortParticles = true;
        mediumStars.sortParticles = true;
        brightStars.sortParticles = true;
        veryBrightStars.sortParticles = true;

        this.starCloud.add(veryDimStars);
        this.starCloud.add(dimStars);
        this.starCloud.add(mediumStars);
        this.starCloud.add(brightStars);
        this.starCloud.add(veryBrightStars);
        this.starCloud.add(markedStars);
        this.starCloud.add(lifeStars);
        this.starCloud.add(habitableStars);

        this.starScene.scene.add(this.starCloudIndex);
        this.starScene.scene.add(this.highlightStar);
        this.starScene.scene.add(this.starCloud);
    };
};
