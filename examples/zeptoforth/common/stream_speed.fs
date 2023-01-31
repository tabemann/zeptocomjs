\ Copyright (c) 2020-2023 Travis Bemann
\
\ Permission is hereby granted, free of charge, to any person obtaining a copy
\ of this software and associated documentation files (the "Software"), to deal
\ in the Software without restriction, including without limitation the rights
\ to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
\ copies of the Software, and to permit persons to whom the Software is
\ furnished to do so, subject to the following conditions:
\ 
\ The above copyright notice and this permission notice shall be included in
\ all copies or substantial portions of the Software.
\ 
\ THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
\ IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
\ FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
\ AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
\ LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
\ OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
\ SOFTWARE.

begin-module stream-speed

  systick import
  task import
  stream import

  \ Element count
  256 constant element-count

  \ Allot the stream
  element-count stream-size buffer: my-stream
  
  \ Stream receive buffer size
  32 constant recv-buffer-size

  \ Stream receive buffer
  recv-buffer-size buffer: recv-buffer
  
  \ Consume data sent via an stream
  : consumer ( -- )
    begin
      recv-buffer recv-buffer-size my-stream recv-stream drop
    again
  ;

  \ Stream send buffer size
  32 constant send-buffer-size

  \ Stream send buffer
  send-buffer-size buffer: send-buffer
  
  \ The send count
  variable send-count

  \ The starting systick
  variable start-systick

  \ The send count limit
  1000000 constant send-count-limit

  \ Act as a stream producer and measure the sending speed
  : producer ( -- )
    begin
      send-buffer send-buffer-size my-stream send-stream
      send-buffer-size send-count +!
      send-count @ send-count-limit > if
	0 send-count !
	systick-counter dup start-systick @ -
	cr ." Sends per second: " 0 swap 0 send-count-limit f/
	10000,0 f/ 1,0 2swap f/ f.
	start-systick !
      then
    again
  ;

  \ Run the stream producer/consumer test
  : speed-test ( -- )
    0 send-count !
    systick-counter start-systick !
    element-count my-stream init-stream
    0 ['] consumer 320 128 512 spawn { consumer-task }
    0 ['] producer 320 128 512 spawn { producer-task }
    consumer-task run
    producer-task run
  ;

end-module

stream-speed::speed-test
