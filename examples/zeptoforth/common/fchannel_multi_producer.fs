\ Copyright (c) 2023 Travis Bemann
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
\ SOFTWARE

begin-module fchan-multi-producer

  task import
  fchan import
  rng import

  \ The fchannel
  fchan-size buffer: my-fchan

  \ Act as an fchannel consumer, printing the received values
  : consumer ( -- )
    begin
      [: my-fchan recv-fchan ;] extract-allot-cell .
    again
  ;

  \ Act as an fchannel producer, sending the number associated with the
  \ producer at 250-1000 ms intervals
  : producer ( id -- )
    begin
      random 750 umod 250 + ms
      dup [: my-fchan send-fchan ;] provide-allot-cell
    again
  ;

  \ Run the fchannel multi-producer test
  : producer-test ( -- )
    my-fchan init-fchan
    0 ['] consumer 320 128 512 spawn { consumer-task }
    0 1 ['] producer 320 128 512 spawn { producer0-task }
    1 1 ['] producer 320 128 512 spawn { producer1-task }
    2 1 ['] producer 320 128 512 spawn { producer2-task }
    consumer-task run
    producer0-task run
    producer1-task run
    producer2-task run
  ;
  
end-module

fchan-multi-producer::producer-test