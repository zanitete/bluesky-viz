/* global console, THREE, Detector */
(function() {
    'use strict';

    var baseUrl = 'http://128.178.97.241:8000/RenderingResourceManager/v1/session';
    var secondsBeforeStartSession = 15; // sec
    var container;
    var camera, controls;
    var openSessionParams = {
        owner: 'favreau',
        renderer: 'livre'
    };
    var positionChangeCounter = 0;
    var renderedImage = document.getElementById('renderedImage');
    var currentCameraPos;
    var error;

    /* loading stuff... */
    var span = document.getElementById('loadingDots');
    var loading = setInterval(function() {
        if ((span.innerHTML += '.').length == 4)
            span.innerHTML = '';
        if(renderedImage.src || error) {
            clearInterval(loading);
            document.getElementById('loadingDiv').className = 'hide';
        }
    }, 500);

    /*
     * rest 'client'
     */
    function doRequest(method, url, callback, body) {
        var oReq = new XMLHttpRequest();
        var bodyStr;
        oReq.onload = callback;
        oReq.withCredentials = true;
        oReq.open(method, url, true);
        if (body) {
            oReq.setRequestHeader('Content-Type', 'application/json');
            bodyStr = JSON.stringify(body);
        }
        oReq.send(bodyStr);
    }

    /*
     * functions to create/destroy a session
     */
    function sessionHandler(action, callback) {
        doRequest(action === 'delete' ? 'DELETE' : 'POST', baseUrl + '/', callback, openSessionParams);
    }

    function createSession(callback) {
        sessionHandler('create', callback);
    }

    function deleteSession(callback) {
        sessionHandler('delete', callback);
    }

    /*
     * starts the renderer once the session is opened.
     */
    function startRenderer(event) {
        console.log(event);
        if (event.target.status === 201) {
            doRequest('PUT', baseUrl + '/execute/open', function() {
                setTimeout(init, secondsBeforeStartSession * 1000);
            });
        } else if (event.target.status === 409) {
            // assume the renderer is already started
            setTimeout(init, secondsBeforeStartSession * 1000);
        } else {
            console.log('error!', event.target);
            error = event.target.responseText;
            var errorDiv = document.getElementById('errorDiv');
            errorDiv.innerHTML += error;
            errorDiv.className += 'show';
        }
    }

    /*
     * init three.js controls and camera.
     */
    function init() {
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
        camera.position.z = 2;

        controls = new THREE.TrackballControls(camera);

        controls.rotateSpeed = 1.0;
        controls.zoomSpeed = 1.2;
        controls.panSpeed = 0.8;

        controls.noZoom = false;
        controls.noPan = false;

        controls.staticMoving = true;
        controls.dynamicDampingFactor = 0.3;

        controls.keys = [65, 83, 68];

        controls.addEventListener('change', render);

        container = document.getElementById('container');

        window.addEventListener('resize', onWindowResize, false);
        render();
        animate();
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        controls.handleResize();
        render();
    }

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
    }

    Number.prototype.toFixedDown = function(digits) {
        var n = this - Math.pow(10, -digits) / 2;
        n += n / Math.pow(2, 53);
        return n.toFixed(digits);
    };

    function getFrameWrapper(position) {
        var frameCameraPosition = position;
        var done = false;
        return function getFrame() {
            if (frameCameraPosition === currentCameraPos &&
                !done) {
                doRequest('GET', baseUrl + '/execute/frame', function(event) {
                    setTimeout(getFrameWrapper(frameCameraPosition), 1000);
                    if(event.target.status === 200) {
                        done = (renderedImage.src === event.target.responseText);
                        renderedImage.src = event.target.responseText;
                    }
                });
            }
        };
    }

    /*
     *positon change callback.
     */
    function render() {
        if (positionChangeCounter++ % 20 === 0) {
            var cameraPos = {
                lookat: '0,0,0',
                up: '0,1,0'
            };
            cameraPos.position = [camera.position.x.toFixed(1),
                                    camera.position.y.toFixed(1),
                                    camera.position.z.toFixed(1)].join(',');
            currentCameraPos = cameraPos.position;
            console.log('new position:', cameraPos.position);

            doRequest('PUT', baseUrl + '/execute/setCamera', getFrameWrapper(currentCameraPos), cameraPos);
        }
    }

    window.onbeforeunload = function() {
        deleteSession();
    };

    // init application
    // 1st remove current session, if any
    deleteSession(function() {
        // 2nd create a new one
        createSession(startRenderer);
    });

})();