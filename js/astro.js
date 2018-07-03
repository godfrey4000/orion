/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
const GC = {x: -0.0549, y: -0.8728, z: -0.4850};
const GEAST = {x: 0.4944, y: -0.4458, z: 0.7463};
const GNP = {x: -0.8675, y: -0.1987, z: 0.4560};

// PI/180
const PI180 = 0.017453;

// Vector scalar product.
var dotp = function(u, v) {
    var w = u.x*v.x + u.y*v.y + u.z*v.z;
    return w;
};

var toGal = function(eq, dnorm) {

	var galData = [];
    eq.forEach( function(d,i) {
        
        // The CSV from services like VizieR sometimes include records with
        // missing values.  The THREE.js library expects to do math operations
        // on these values.  Anything that's not a number must be excluded.
        var ra = parseFloat(d.ra);
        var dec = parseFloat(d.dec);
        var plx = parseFloat(d.Plx);
        if (isNaN(ra) || isNaN(dec) || isNaN(plx)) {
            console.info("Record " + i.toString() + " missing ra, dec or Plx");
            return;
        }
        
        var dist;
        var n = {}, g = {};
        var tagged, habitable, attribute, spectrum, temperature, luminosity;
        
        // Compute the distance (in light years) from the parallax.
        dist = dnorm*3262/plx;
        
        // Compute the absolute magnitude from the parallax and the apparent
        // magnitude.
        if (d.Amag !== undefined) {
            var Amag = parseFloat(d.Amag);
        }
        else if (d.Vmag !== undefined) {
            var mag = parseFloat(d.Vmag);
            var Amag = 1.0*mag + 5*Math.log10(plx/100);
        }
        else {
            console.info("Record " + i.toString() + " missing Vmag or Amag");
            return;
        }

        // Convert to cartesian equitorial coordinates.
        n = {
          x: Math.cos(ra*PI180)*Math.cos(dec*PI180),
          y: Math.sin(ra*PI180)*Math.cos(dec*PI180),
          z: Math.sin(dec*PI180)
        };
        
        // Calculate n*c, n*(cxp) and n*p
        g = {
          u: dist*dotp(n, GC),
          v: dist*dotp(n, GEAST),
          w: dist*dotp(n, GNP)
        };
        
        // Attribute and tagged are optional, and may be missing in the input
        // stream (file).
        if (d.tagged !== undefined) {
            tagged = (d.tagged.length > 0 && parseInt(d.tagged) > 0);
        }
        if (d.habitable !== undefined && d.habitable.length > 0) {
            habitable = (parseInt(d.habitable) > 0);
        }
        if (d.attr !== undefined && d.attr.length > 0) {
            attribute = d.attr;
        }
        if (d.SpType !== undefined && d.SpType.length > 0) {
            spectrum = d.SpType.charAt(0);
        }
        if (d.teff !== undefined) {
            temperature = parseFloat(d.teff);
        }
        if (d.lum !== undefined) {
            luminosity = parseFloat(d.lum);
        }
        galData[i] = {
          position: g,
          magnitude: Amag,
          spectrum: spectrum,
          tagged: tagged,
          habitable: habitable,
          attribute: attribute,
          temperature: temperature,
          luminosity: luminosity
        };
    });
    return galData;
};