
var WebVRManager = function(renderer) {
	
	// Need a window event to announce the VR display has connected.
	this.VRConnected = false;
	
	// If the navigator object does not have the getVRDisplays() method, then
	// WebVR is not supported.
	if ( 'getVRDisplays' in navigator ) {
		this.webVRSupport = true;
	}
	else {
		this.webVRSupport = false;
	}
	
	// If WebVR is not supported, no need to go any further than showing a
	// disabled button.
	if (this.webVRSupport !== true) {
		return;
	}
	
	// The VR display needs to know the canvas to be displayed, which is the
	// renderer's DOM element.
	this.renderer = renderer;

/*		window.addEventListener( 'vrdisplaydisconnect', function ( event ) {

			alert("Event vrdisplaydisconnect");
			have_item('webvr_connect', false);
			this.showVRNotFound();

		}, false );

		window.addEventListener( 'vrdisplaypresentchange', function ( event ) {

			alert("Event vrdisplaypresentchange");
			this.button.textContent = event.display.isPresenting ? 'EXIT VR' : 'ENTER VR';

		}, false );

		window.addEventListener( 'vrdisplayactivate', function ( event ) {

			alert("Event vrdisplayactivate");
			event.display.requestPresent( [ { source: renderer.domElement } ] );

		}, false );*/

	// The built-in variable "this" goes out of scope inside function.  The
	// trick to get around that is to create the alias self.
	self = this;

	// For some reason, currently a total mystery to me, the prototype
	// functions as callback functions, cannot call another method.
	// So, without understanding what's going on, the patterns below are the
	// only ones that work.
	this.activateButtons = function(device) {

			self.makeitgo = function() {
				
				self.renderer.vr.enabled = true;
				self.renderer.vr.userHeight = 0;
				device.requestPresent( [{source: self.renderer.domElement}] );
			};
			self.renderer.vr.setDevice( device );
	};
	this.receiveDisplays = function(displays) {
		if (displays.length > 0) {
			self.displays = displays;
		}
	};

	// A JavaScript Promise to return a list of displays.  The first one
	this.promiseDisplays = navigator.getVRDisplays();
	this.promiseDisplays.then(this.receiveDisplays);
	
	// VR display CONNECT handler.
	this.hndlVRDisplayConnect = function(event) {
		self.VRConnected = true;
		self.device = event.display;
		self.activateButtons(event.display);
	};
	window.addEventListener('vrdisplayconnect', this.hndlVRDisplayConnect, false);

	// VR display present change handler.
	this.hndlVRDisplayPresentChange = function(event) {
		
            // For an undiscovered reason, the scene is behind the user when the VR
            // display is activated.  So this rotates the camera 180 degrees about
            // the y-axis.
            self.renderer.vr.enabled = event.display.isPresenting;
//            flipScene();
//            updateOrbitControls();
	};
	window.addEventListener('vrdisplaypresentchange', this.hndlVRDisplayPresentChange, false);
};

// Start the VR rendering.
WebVRManager.prototype.activateVR = function() {
	
	// Only start VR rendering if the VR display is connected.
	if (this.webVRSupport && this.VRConnected) {
		
            flipScene();
            this.makeitgo();
	}
};
