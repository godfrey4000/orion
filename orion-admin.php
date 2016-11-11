<?php
/** Step 2 (from text above). */
add_action( 'admin_menu', 'orion_admin_create_menu');

/** Step 1. */
function orion_admin_create_menu()
{
	add_options_page( 'Orion Plugin Options', 'orion', 'manage_options', __FILE__, 'orion_settings_page' );

	add_action( 'admin_init', 'register_orion_settings' );
}

function register_orion_settings()
{
	register_setting( 'orion-servers-group', 'star_server' );
        register_setting( 'orion-servers-group', 'tap_service' );
}

// The settings page
function orion_settings_page()
{
	if ( !current_user_can( 'manage_options' ) )  {
		wp_die( __( 'You do not have sufficient permissions to access this page.' ) );
	}
?>

<div class="wrap">
<h2>Orion Star Maps Options</h2>
<form method="post" action="options.php">
	<?php settings_fields( 'orion-servers-group' ); ?>
	<?php do_settings_sections( 'orion-servers-group' ); ?>

	<table class="form-table">
        <tr valign="top">
        <th scope="row">Star Cache Server</th>
        <td><input type="text" name="star_server" value="<?php echo esc_attr( get_option('star_server') ); ?>" /></td>
        </tr>

        <tr valign="top">
        <th scope="row">TAP Service</th>
        <td><input type="text" name="tap_service" value="<?php echo esc_attr( get_option('tap_service') ); ?>" /></td>
        </tr>
        </table>
  
	<?php submit_button(); ?>
</form>
</div>

<?php
}
?>
