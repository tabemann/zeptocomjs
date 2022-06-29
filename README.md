# zeptocom.js

zeptocom.js is a web-based serial terminal designed for use with zeptoforth on PC-based web browsers other than Firefox, which sadly does not support the Web Serial API on which it relies (thanks to the infinite wisdom of the people at Mozilla). It also does not work with older versions of Chromium, such as the version distributed with Debian.

Currently it is in a very rudimentary state, but it is still functional. One can enter lines of text manually, or one can use a text area to edit code to mass upload.

Mass uploads properly take into account ACK and NAK characters sent my zeptoforth over serial for controlling the flow of data without the need for arbitrary delays, and so that when errors occur uploading stops immediately. I will write more here as it gets more mature.
