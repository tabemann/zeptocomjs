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

begin-module fchannel-speed

  systick import
  task import
  fchan import

  \ Allot the channel
  fchan-size buffer: my-fchan

  \ Consume data sent via an fchannel
  : consumer ( -- )
    begin
      [: my-fchan recv-fchan ;] extract-allot-cell drop
    again
  ;

  \ The send count
  variable send-count

  \ The starting systick
  variable start-systick

  \ The send count limit
  10000 constant send-count-limit

  \ Act as an fchannel producer and measure the sending speed
  : producer ( -- )
    begin
      0 [: my-fchan send-fchan ;] provide-allot-cell
      1 send-count +!
      send-count @ send-count-limit > if
	0 send-count !
	systick-counter dup start-systick @ -
	cr ." Sends per second: " 0 swap 0 send-count-limit f/
	10000,0 f/ 1,0 2swap f/ f.
	start-systick !
      then
    again
  ;

  \ Run the fchannel producer/consumer test
  : speed-test ( -- )
    0 send-count !
    systick-counter start-systick !
    my-fchan init-fchan
    0 ['] consumer 320 128 512 spawn { consumer-task }
    0 ['] producer 320 128 512 spawn { producer-task }
    consumer-task run
    producer-task run
  ;

end-module

fchannel-speed::speed-test
