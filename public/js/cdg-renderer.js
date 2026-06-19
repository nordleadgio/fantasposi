class CdgRenderer {

    constructor(canvas){

        this.canvas = canvas;
        this.context = canvas.getContext("2d");
        this.packetSize = 24;
        this.packetRate = 300;
        this.screenWidth = 300;
        this.screenHeight = 216;
        this.bytes = new Uint8Array();
        this.packetCount = 0;
        this.currentPacket = 0;
        this.screen =
            new Uint8Array(
                this.screenWidth * this.screenHeight
            );
        this.colors =
            Array.from(
                { length: 16 },
                () => [0, 0, 0]
            );
        this.colors[1] = [255, 255, 255];
        this.transparentColor = -1;
        this.imageData =
            this.context.createImageData(
                this.screenWidth,
                this.screenHeight
            );

    }

    load(buffer){

        this.bytes =
            new Uint8Array(buffer);

        this.packetCount =
            Math.floor(
                this.bytes.length / this.packetSize
            );

        this.reset();

    }

    reset(){

        this.currentPacket = 0;
        this.screen.fill(0);
        this.colors =
            Array.from(
                { length: 16 },
                () => [0, 0, 0]
            );
        this.colors[1] = [255, 255, 255];
        this.transparentColor = -1;
        this.draw();

    }

    clear(){

        this.screen.fill(0);
        this.draw();

    }

    renderToTime(time){

        const targetPacket =
            Math.max(
                0,
                Math.min(
                    this.packetCount,
                    Math.floor(
                        (Number(time) || 0) *
                        this.packetRate /
                        1000
                    )
                )
            );

        if(targetPacket < this.currentPacket){
            this.reset();
        }

        if(targetPacket === this.currentPacket){
            return;
        }

        while(this.currentPacket < targetPacket){
            this.renderPacket(this.currentPacket);
            this.currentPacket += 1;
        }

        this.draw();

    }

    renderPacket(packetIndex){

        const offset =
            packetIndex * this.packetSize;

        if(offset + this.packetSize > this.bytes.length){
            return;
        }

        const command =
            this.bytes[offset] & 0x3f;

        const instruction =
            this.bytes[offset + 1] & 0x3f;

        if(command !== 9){
            return;
        }

        const payload =
            Array.from(
                this.bytes.slice(offset + 4, offset + 20),
                value => value & 0x3f
            );

        if(instruction === 1){
            this.screen.fill(payload[0] & 0x0f);
            return;
        }

        if(instruction === 2){
            this.fillBorder(payload[0] & 0x0f);
            return;
        }

        if(instruction === 6 || instruction === 38){
            this.renderTile(payload, instruction === 38);
            return;
        }

        if(instruction === 20 || instruction === 24){
            this.scroll(payload, instruction === 20);
            return;
        }

        if(instruction === 28){
            this.transparentColor =
                payload[0] & 0x0f;
            return;
        }

        if(instruction === 30 || instruction === 31){
            this.setColorTable(payload, instruction === 30 ? 0 : 8);
        }

    }

    fillBorder(color){

        for(let y = 0; y < this.screenHeight; y += 1){
            for(let x = 0; x < this.screenWidth; x += 1){
                if(
                    x < 6 ||
                    x >= 294 ||
                    y < 12 ||
                    y >= 204
                ){
                    this.screen[y * this.screenWidth + x] = color;
                }
            }
        }

    }

    renderTile(payload, xor){

        const color0 = payload[0] & 0x0f;
        const color1 = payload[1] & 0x0f;
        const row = payload[2] & 0x1f;
        const col = payload[3] & 0x3f;
        const x0 = col * 6;
        const y0 = row * 12;

        for(let y = 0; y < 12; y += 1){

            const line = payload[4 + y];

            for(let x = 0; x < 6; x += 1){

                this.setPixel(
                    x0 + x,
                    y0 + y,
                    ((line >> (5 - x)) & 1) ? color1 : color0,
                    xor
                );

            }

        }

    }

    scroll(payload, usePresetColor){

        const color = payload[0] & 0x0f;
        const hScroll = payload[1] & 0x3f;
        const vScroll = payload[2] & 0x3f;
        const horizontalCommand = (hScroll & 0x30) >> 4;
        const verticalCommand = (vScroll & 0x30) >> 4;
        let deltaX = 0;
        let deltaY = 0;

        if(horizontalCommand === 1){
            deltaX = 6;
        }else if(horizontalCommand === 2){
            deltaX = -6;
        }

        if(verticalCommand === 1){
            deltaY = 12;
        }else if(verticalCommand === 2){
            deltaY = -12;
        }

        if(deltaX === 0 && deltaY === 0){
            return;
        }

        const next =
            new Uint8Array(this.screen.length);

        next.fill(usePresetColor ? color : 0);

        for(let y = 0; y < this.screenHeight; y += 1){
            for(let x = 0; x < this.screenWidth; x += 1){

                const sourceX = x - deltaX;
                const sourceY = y - deltaY;

                if(
                    sourceX >= 0 &&
                    sourceX < this.screenWidth &&
                    sourceY >= 0 &&
                    sourceY < this.screenHeight
                ){
                    next[y * this.screenWidth + x] =
                        this.screen[
                            sourceY * this.screenWidth + sourceX
                        ];
                }

            }
        }

        this.screen = next;

    }

    setColorTable(payload, start){

        for(let index = 0; index < 8; index += 1){
            this.colors[start + index] =
                this.decodeColor(
                    payload[index * 2],
                    payload[index * 2 + 1]
                );
        }

    }

    decodeColor(first, second){

        const red = (first & 0x3c) >> 2;
        const green =
            ((first & 0x03) << 2) |
            ((second & 0x30) >> 4);
        const blue = second & 0x0f;

        return [
            red * 17,
            green * 17,
            blue * 17
        ];

    }

    setPixel(x, y, color, xor){

        if(
            x < 0 ||
            x >= this.screenWidth ||
            y < 0 ||
            y >= this.screenHeight
        ){
            return;
        }

        const index =
            y * this.screenWidth + x;

        this.screen[index] =
            xor
            ? this.screen[index] ^ color
            : color;

    }

    draw(){

        for(let y = 0; y < this.screenHeight; y += 1){
            for(let x = 0; x < this.screenWidth; x += 1){

                const source =
                    y * this.screenWidth + x;

                const target =
                    source * 4;

                const colorIndex =
                    this.screen[source] & 0x0f;

                const color =
                    this.colors[colorIndex] || [0, 0, 0];

                this.imageData.data[target] = color[0];
                this.imageData.data[target + 1] = color[1];
                this.imageData.data[target + 2] = color[2];
                this.imageData.data[target + 3] =
                    colorIndex === this.transparentColor
                    ? 0
                    : 255;

            }
        }

        this.context.putImageData(
            this.imageData,
            0,
            0
        );

    }

}
