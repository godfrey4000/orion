<?php
/*
Plugin Name: Orion
Description: Display 3D, interactive star fields near the Sun, in the Orion spur.
Version: 1.0
Author: Neil Godfrey
Author URI: http://neilgodfrey.com
*/

defined( 'ABSPATH' ) or die( 'No script kiddies please!' );

require_once( dirname( __FILE__ ) . '/orion-admin.php' );

/*
** Build the <div> element that represents the viewport for
** the star map.  The scene's <div> element will typically
** be nested in a [caption] shortcode block.  The attributes
** of width and height are set for the <div> element.  The
** <div> element is given a unique ID to support more than one
** star map on a page.
**
** The <div> element is used because the <canvas> tag is
** working.
*/
function orion_build_scene_div( $atts )
{
	// Pass the id independently, so the JavaScript engine can find
	// the <div> element.  Pass the width and height independently,
	// the browser can set the size of the <div> element.
	$id = $atts['canvasID'];
	$w = $atts['width'];
	$h = $atts['height'];

	// Convert the parameters array to JSON.  This is a safe way
	// to pass all the star map data to the JavaScript Three.js
	// library.
	$jsonParams = json_encode($atts);

        // Include the three svg icons for the cardboard viewer, the
	// 3D glasses and the movie play icon.
	$svgCardboard = file_get_contents(dirname( __FILE__) . '/images/cardboard.svg');
	$svgGlasses = file_get_contents(dirname(__FILE__) . '/images/glasses3d.svg');
	$svgPlay = file_get_contents(dirname(__FILE__) . '/images/play.svg');

	$html = $svgCardboard . $svgGlasses . $svgPlay
                        . '<div class="starMap" id="' . $id . '"'
			. ' style="width: ' . $w . 'px;'
			. ' height: ' . $h. 'px;"'
			. ' data-map-params=\'' . $jsonParams . '\'></div>'
                        . '<div class="starMapMsg" id="msg_' . $id . '"'
                        . ' style="width: ' . $w . 'px;"></div>';
	return $html;
}

/*
function orion_enqueue_styles()
{
	wp_register_style( 'scene_div', plugin_dir_url(__FILE__) . 'css/scene.css');
	wp_enqueue_style( 'scene_div' );
}
*/

function orion_enqueue_scripts()
{
        wp_register_style( 'orion_css', plugin_dir_url(__FILE__) . 'css/orion.css');

	wp_register_script( 'd3_js', 'http://d3js.org/d3.v3.min.js');
	wp_register_script( 'Three_js', plugin_dir_url(__FILE__) . 'js/three.js');
	wp_register_script( 'Detector_js', plugin_dir_url(__FILE__) . 'js/Detector.js');
	wp_register_script( 'Projector_js', plugin_dir_url(__FILE__) . 'js/Projector.js');
	wp_register_script( 'Canvas_js', plugin_dir_url(__FILE__) . 'js/CanvasRenderer.js');
	wp_register_script( 'Stereo_js', plugin_dir_url(__FILE__) . 'js/StereoEffect.js');
//	wp_register_script( 'Anaglyph_js', plugin_dir_url(__FILE__) . 'js/AnaglyphEffect.js');
	wp_register_script( 'OrbitControls_js', plugin_dir_url(__FILE__) . 'js/OrbitControls.js');
	wp_register_script( 'OrientControls_js', plugin_dir_url(__FILE__) . 'js/DeviceOrientationControls.js');
        wp_register_script( 'astro_js', plugin_dir_url(__FILE__) . 'js/astro.js');
        wp_register_script( 'starcolor_js', plugin_dir_url(__FILE__) . 'js/starcolor.js');
	wp_register_script( 'utils_js', plugin_dir_url(__FILE__) . 'js/utils.js');
	wp_register_script( 'orion_js', plugin_dir_url(__FILE__) . 'js/orion.js');
        
        wp_enqueue_style('orion_css');
        
        wp_enqueue_script('d3_js');
	wp_enqueue_script('Three_js');
	wp_enqueue_script('Projector_js');
	wp_enqueue_script('Canvas_js');
        wp_enqueue_script('Stereo_js');
        wp_enqueue_script('Anaglyph_js');
	wp_enqueue_script('Detector_js');
	wp_enqueue_script('OrbitControls_js');
	wp_enqueue_script('OrientControls_js');
        wp_enqueue_script('starcolor_js');
        wp_enqueue_script('astro_js');
	wp_enqueue_script('utils_js');
	wp_enqueue_script('orion_js');
}

/*
 *	[orion]
 *
 *	The [orion] short code creates the div area on the page where the 3D
 *      scene will render.  It has these required attributes:
 *		width, height, stardata
 */
function orion_shortcode( $atts, $content = '' )
{
	// Attributes
	$a = shortcode_atts( array(
		'scale'		=> '100',
		'width'		=> '300',
		'sun'		=> 'true'
	), $atts );

	// Add the div element to the page that will hold the star map.
	// The ID should be unique to support more than one star map on
	// a page.
	$canvasID = uniqid();
	$mapParams['canvasID'] = $canvasID;

	$mapParams['scale']		= $a['scale'];
	$mapParams['width']		= $a['width'];
        
        // The height, for undetermined reasons, must be the same as the width.
	$mapParams['height']		= $a['width'];

	// The Sun should be included, unless it is explicitly excluded.
	if( empty($a['sun']) ) {
		$mapParams['sun'] = true;
	}
	elseif( 'TRUE' == strtoupper($a['sun']) ) {
		$mapParams['sun'] = true;
	}
	else {
		$mapParams['sun'] = false;
	}

	// If the position of the camera is not specified, then the js
	// will it on the z-axis, above the galactic plane.
	//
	// The position attribute is not required, and it cannot have
	// a constant default value.  So the function shortcode_atts()
	// won't copy it to the result array.
	if( !empty($atts['position']) ) {
		$x = floatval( explode( ',', $atts['position'] )[0] );
		$y = floatval( explode( ',', $atts['position'] )[1] );
		$z = floatval( explode( ',', $atts['position'] )[2] );
		$mapParams['position'] = [$x, $y, $z];
	}

        if( empty($atts['service']) ) {
            // In this instance we must have a source.  (For now.  Perhaps a
            // basic star field, like all the stars within 100 light years.)
            $star_base_url = get_option('star_server');
            $star_url = $star_base_url . '/' . $atts['source'] . '.csv';
            $mapParams['source'] = $star_url;
            $mapParams['adlQuery'] = false;
        }
        else {
            // A service is an online star catalog that supports ADQL and
            // returns a CSV.
            $tap_service = get_option('tap_service');
            $mapParams['server'] = $tap_service;
            $mapParams['service'] = $atts['service'];
            $mapParams['query'] = html_entity_decode($atts['adql']);
            $mapParams['adlQuery'] = true;
        }
        
	// If not done so already, register and enqueue the styles and
	// the scripts
	orion_enqueue_scripts();
	do_shortcode( $content );
	$html = orion_build_scene_div( $mapParams );
	return $html;
}


add_shortcode('orion', 'orion_shortcode');

?>
