\ Copyright (c) 2021-2023 Travis Bemann
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

begin-module pio-blinky

  interrupt import
  pio import
  task import
  systick import

  \ The initial PIO setup, to be executed once
  create pio-init
  1 SET_PINDIRS set,
  0 SET_PINS set,
  
  \ The PIO code, which is executed in loops based on counts fed in
  \ through the TX FIFO
  create pio-code
  PULL_BLOCK PULL_NOT_EMPTY pull,
  32 OUT_X out,
  1 SET_PINS set,
  3 COND_X1- jmp,
  PULL_BLOCK PULL_NOT_EMPTY pull,
  32 OUT_X out,
  0 SET_PINS set,
  7 COND_X1- jmp,

  \ The blinky state
  variable blinky-state

  \ The blinky maximum input shade
  125 constant max-shade-input

  \ The blinky maximum shade
  variable max-shade
  
  \ The blinky shading
  variable shade-level

  \ The blinky shade step delay in 100 us increments
  25 constant blinky-step-delay

  \ The blinky multiplier
  500,0 2constant blinky-multiply

  \ The blinky pre-multiplier
  5,0 2constant blinky-premultiply

  \ The blinky shade conversion routine
  : convert-shade ( i -- shade )
    0 swap max-shade-input s>f f/ pi f* cos dnegate 1,0 d+ 2,0 f/
    blinky-premultiply f* expm1 blinky-premultiply expm1 f/
    blinky-multiply f* nip
  ;

  \ PIO interrupt handler
  : handle-pio ( -- )
    blinky-state @ not if
      shade-level @ 0 PIO0 sm-txf!
    else
      max-shade @ shade-level @ - 0 PIO0 sm-txf!
    then
    blinky-state @ not blinky-state !
    PIO0_IRQ0 NVIC_ICPR_CLRPEND!
  ;

  \ Set the shading
  : shade-level! ( i -- )
    convert-shade shade-level !
  ;
  
  \ The blinky shading task loop
  : do-blink ( -- )
    begin
      max-shade-input 0 ?do
	i shade-level!
	systick-counter blinky-step-delay current-task delay
      loop
      0 max-shade-input ?do	
	i shade-level!
	systick-counter blinky-step-delay current-task delay
      -1 +loop
    again
  ;

  \ Start the PIO shading blinky
  : blink ( -- )
    
    \ Initialize our blinky state
    true blinky-state !
    max-shade-input convert-shade max-shade !
    0 shade-level!

    \ Disable and restart state machine 0 of PIO0
    %0001 PIO0 sm-disable
    %0001 PIO0 sm-restart

    \ Set the clock divisor of state machine 0 of PIO0
    0 758 0 PIO0 sm-clkdiv!

    \ Set state machine 0 of PIO0 to act on GPIO pin 25, the LED pin
    25 1 0 PIO0 sm-set-pins!

    \ Wrap around from instruction 7 to instruction 0
    0 7 0 PIO0 sm-wrap!

    \ Set pins to retain their state after being set
    on 0 PIO0 sm-out-sticky!

    \ Execute the instructions in pio-init on state machine 0 of PIO0
    pio-init 2 0 PIO0 sm-instr!

    \ Load state machine 0 of PIO0 with the instructions in pio-code
    pio-code 8 PIO0 pio-instr-mem!

    \ Set the initial addres of state machine 0 of PIO0
    0 0 PIO0 sm-addr!

    \ Initialize the TX FIFO of state machine 0 of PIO0 with shade-level
    shade-level @ 0 PIO0 sm-txf!

    \ Initialize PIO0 interrupt handling
    ['] handle-pio PIO0_IRQ0 16 + vector!
    0 INT_SM_TXNFULL IRQ0 PIO0 pio-interrupt-enable
    PIO0_IRQ0 NVIC_ISER_SETENA!

    \ Enable PIO0
    %0001 PIO0 sm-enable

    \ Start our task controlling the blink level
    0 ['] do-blink 320 128 512 spawn run
  ;

end-module

pio-blinky::blink
