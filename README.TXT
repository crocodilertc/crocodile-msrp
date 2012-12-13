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

QUnit v1.10.0
Copyright 2012 jQuery Foundation and other contributors
Released under the MIT license.

Building
======== 

* Download and install Node (http://nodejs.org/)
* Install Grunt using the Node Package Manager (npm install -g grunt)
* Run grunt (grunt.cmd on Windows) in the top-level directory (the one
containing grunt.js) 

Build targets
============= 

* lint: Runs JSLint (http://www.jslint.com) to pick up possible coding 
issues
* concat: Concatenates all of the source files into a single JS file (CrocMSRP.js)
* min: Runs UglifyJS to minimise the source into a single JS file (CrocMSRP.min.js)
* test: Attempts to run any unit tests. Requires PhantomJS, and I couldn't get
this working. 

Building documentation
====================== 

Documentation can be generated from the comments within the source. To 
do this:

* Download and install JSDoc Toolkit (http://code.google.com/p/jsdoc-toolkit/)
* Run the following command line in the JSDoc directory:
java -jar jsrun.jar app/run.js -t=templates/jsdoc -d=<output dir> <src dir/files>

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

