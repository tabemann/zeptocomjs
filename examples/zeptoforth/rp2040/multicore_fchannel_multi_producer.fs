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

begin-module multicore-fchan-multi-producer

  task import
  fchan import
  rng import

  \ The fchannel
  fchan-size buffer: my-fchan

  \ Act as an fchannel consumer, printing the received values plus its
  \ CPU index times two
  : consumer ( -- )
    begin
      [: my-fchan recv-fchan ;] extract-allot-cell cpu-index 2 * + .
    again
  ;

  \ Act as an fchannel producer, sending the CPU index associated with the
  \ producer at 250-1000 ms intervals
  : producer ( -- )
    begin
      random 750 umod 250 + ms
      cpu-index [: my-fchan send-fchan ;] provide-allot-cell
    again
  ;

  \ Run the fchannel multi-producer test
  : producer-test ( -- )
    my-fchan init-fchan
    0 ['] consumer 320 128 512 0 spawn-on-core { consumer0-task }
    0 ['] consumer 320 128 512 1 spawn-on-core { consumer1-task }
    0 ['] producer 320 128 512 0 spawn-on-core { producer0-task }
    0 ['] producer 320 128 512 1 spawn-on-core { producer1-task }
    consumer0-task run
    consumer1-task run
    producer0-task run
    producer1-task run
  ;
  
end-module

multicore-fchan-multi-producer::producer-test
