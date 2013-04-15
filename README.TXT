Crocodile MSRP
Javascript MSRP over WebSocket stack
http://code.google.com/p/crocodile-msrp/

Copyright (c) 2012 Crocodile RCS Ltd
http://www.crocodile-rcs.com

Released under the MIT license - see LICENSE.TXT.

Dependencies
============

The following dependencies are included in the distribution:

md5.js v2.2
Copyright (C) Paul Johnston 1999 - 2009
Distributed under the BSD License.

QUnit v1.11.0
Copyright 2012 jQuery Foundation and other contributors
Released under the MIT license.

Building
======== 

* Download and install Node >= 0.8.0 (http://nodejs.org/)
* If you haven't used the Grunt build tool before, install the command-line
tool using the Node Package Manager:
    npm install -g grunt-cli
* Install Grunt and other dependencies by changing to the project directory and
running the following:
    npm install
* Run "grunt" in the project directory (the one containing Gruntfile.js) .

Build targets
============= 

* jshint: Runs JSHint (http://www.jshint.com) to pick up possible coding 
issues.
* clean: Removes any build output from the dist directory.
* concat: Concatenates all of the source files into a single JS file
(crocodile-msrp.js).
* uglify: Runs UglifyJS to "minify" the concatenated source, reducing the file
size (crocodile-msrp.min.js).
* qunit: Attempts to run any unit tests under PhantomJS. This is not currently
working with PhantomJS 0.9, and thus has been removed from the default build
target. To run the unit tests successfully, open test/test.html in a browser.
* jsdoc: Generates HTML documentation for the public library interfaces.

Testing
======= 

The unit tests are contained in the "test" subdirectory. Simply open 
test.html in your chosen browser, and confirm that the tests have 
passed. 

The test.html in the top-level directory attempts to start two websocket 
clients, and simulate the SDP exchange between them. This is useful in 
conjuntion with the JavaScript console (Ctrl-Shift-I) in Chrome, which 
can be used to send messages between the clients and check everything is 
behaving as expected. Note that the file transfer part is very 
rudimentary; it should be starting separate MSRP sessions for each file 
transfer instead of using the existing session. 

Testing so far has been exclusively with Chrome 23, and using the 
current development trunk of Kamailio as the MSRP WebSocket relay. 

