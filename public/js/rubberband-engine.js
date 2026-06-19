(function(){

    const PROCESSOR_URL =
        "/vendor/rubberband-processor.js";

    function createRubberBandNode(context, url, options){

        function createNode(){

            const node =
                new AudioWorkletNode(
                    context,
                    "rubberband-processor",
                    options
                );

            node.setPitch = (pitch) => {
                node.port.postMessage(
                    JSON.stringify(["pitch", pitch])
                );
            };

            node.setTempo = (tempo) => {
                node.port.postMessage(
                    JSON.stringify(["tempo", tempo])
                );
            };

            node.setHighQuality = (enabled) => {
                node.port.postMessage(
                    JSON.stringify(["quality", enabled])
                );
            };

            node.close = () => {
                node.port.postMessage(
                    JSON.stringify(["close"])
                );
            };

            return node;

        }

        try {
            return Promise.resolve(createNode());
        } catch(err) {
            return context.audioWorklet
                .addModule(url)
                .then(createNode);
        }

    }

    class RubberBandChannel {

        constructor(context, media, rubberNode){

            this.context = context;
            this.media = media;
            rubberNode.setHighQuality(true);
            this.currentSemitones = 0;
            this.pitchRamp = null;
            this.source =
                context.createMediaElementSource(media);
            this.rubberNode = rubberNode;
            this.source.connect(rubberNode);
            rubberNode.connect(context.destination);

        }

        setPitch(semitones, immediate){

            const target =
                Number(semitones || 0);

            if(this.pitchRamp){
                clearInterval(this.pitchRamp);
                this.pitchRamp = null;
            }

            if(immediate){
                this.currentSemitones = target;
                this.setPitchRatio(target);
                return;
            }

            const start =
                this.currentSemitones;

            const delta =
                target - start;

            if(Math.abs(delta) < 0.01){
                this.currentSemitones = target;
                this.setPitchRatio(target);
                return;
            }

            const steps = 6;
            let step = 0;

            this.pitchRamp =
                setInterval(() => {
                    step += 1;

                    const progress =
                        step / steps;

                    const next =
                        start + delta * progress;

                    this.currentSemitones = next;
                    this.setPitchRatio(next);

                    if(step >= steps){
                        clearInterval(this.pitchRamp);
                        this.pitchRamp = null;
                        this.currentSemitones = target;
                        this.setPitchRatio(target);
                    }
                }, 15);

        }

        setPitchRatio(semitones){

            const ratio =
                Math.pow(2, semitones / 12);

            this.rubberNode.setPitch(ratio);

        }

    }

    class GiorgioRubberBandEngine {

        constructor(){

            const AudioContext =
                window.AudioContext ||
                window.webkitAudioContext;

            if(!AudioContext){
                throw new Error("Web Audio non disponibile");
            }

            this.context =
                new AudioContext();

            this.channels =
                new Map();

            this.pitchShift = 0;

        }

        async connect(media){

            if(this.channels.has(media)){
                return;
            }

            const rubberNode =
                await createRubberBandNode(
                    this.context,
                    PROCESSOR_URL
                );

            const channel =
                new RubberBandChannel(
                    this.context,
                    media,
                    rubberNode
                );

            channel.setPitch(this.pitchShift, true);
            this.channels.set(media, channel);

        }

        async resume(){

            if(this.context.state !== "running"){
                await this.context.resume();
            }

        }

        setPitchShift(semitones){

            this.pitchShift =
                Math.max(
                    -6,
                    Math.min(6, Number(semitones || 0))
                );

            this.channels.forEach(channel => {
                channel.setPitch(this.pitchShift);
            });

        }

    }

    window.GiorgioRubberBandEngine =
        GiorgioRubberBandEngine;

    globalThis.GiorgioRubberBandEngine =
        GiorgioRubberBandEngine;

})();
