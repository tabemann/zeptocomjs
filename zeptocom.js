let ackCount = 0;
let nakCount = 0;

function delay(ms) {
    return new Promise(resolve => {
        setTimeout(() => { resolve('') }, ms);
    })
}

async function getSerial(term) {
    const port = await navigator.serial.requestPort({ filters: [] });
    await port.open({ baudRate: 115200 });
    const connectButton = document.getElementById("connect");
    connectButton.style.display = 'none';
    const lineNode = document.getElementById('line');
    lineNode.addEventListener('keyup', async event => {
	if(event.key === 'Enter') {
	    const encoder = new TextEncoder();
	    const writer = port.writable.getWriter();
	    try {
		await writer.write(encoder.encode(lineNode.value + '\r'));
		lineNode.value = '';
	    } catch(error) {
	    } finally {
		writer.releaseLock();
	    }
	}
    });
    const sendButton = document.getElementById("send");
    const area = document.getElementById("area");
    sendButton.addEventListener('click', async () => {
	const lines = area.value.split(/\r?\n/);
	let currentAckCount = ackCount;
	let currentNakCount = nakCount;
	for(const line of lines) {
	    const encoder = new TextEncoder();
	    const writer = port.writable.getWriter();
	    try {
		await writer.write(encoder.encode(line + '\r'));
		while(ackCount == currentAckCount &&
		      nakCount == currentNakCount) {
		    await delay(0);
		}
		currentAckCount = ackCount;
		if(nakCount != currentNakCount) {
		    break;
		}
	    } catch(error) {
	    } finally {
		writer.releaseLock();
	    }
	}
    });
    while (port.readable) {
	const reader = port.readable.getReader();
	try {
	    while (true) {
		const { value, done } = await reader.read();
		if (done) {
		    break;
		}
		for(let i = 0; i < value.length; i++) {
		    if(value[i] == 0x06) {
			ackCount++;
		    }
		    if(value[i] == 0x15) {
			nakCount++;
		    }
		}
		term.write(value);
	    }
	} finally {
	    reader.releaseLock();
	}
    }
}

function startTerminal() {
    let term = new Terminal();
    term.open(document.getElementById('terminal'));
    term.setOption('bellStyle', 'both');
    term.setOption('cursorStyle', 'block');
    term.write('Welcome to zeptocom.js\r\n')
    term.write('Copyright (c) 2022 Travis Bemann\r\n');
    term.write('zeptocom.js comes with ABSOLUTELY NO WARRANTY: ' +
	       'it is licensed under the terms of the MIT license\r\n');

    const connectButton = document.getElementById("connect");
    connectButton.addEventListener('click', () => {
	try {
	    getSerial(term);
	} catch(e) {
	}
    });
}

