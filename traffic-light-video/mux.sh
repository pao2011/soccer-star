#!/bin/sh
# Places each narration sentence (cut from the mp3s at their pauses) at its scene's start time.
# usage: sh mux.sh video-sin-audio.mp4 salida.mp4
set -e
cd "$(dirname "$0")"
F=""; M=""; i=0
# input(1=narracion.mp3, 2=narracion2.mp3) start end delay (seconds)
while read n a b d; do
  F="$F[$n:a]atrim=$a:$b,asetpts=PTS-STARTPTS,adelay=$(echo "$d*1000/1" | bc):all=1[s$i];"; M="$M[s$i]"; i=$((i+1))
done <<SEGS
1 0 6.02 0.2
1 6.46 10.16 6.5
1 10.69 16.86 13.0
1 17.30 23.99 19.6
1 24.43 30.34 26.4
1 30.79 37.10 34.7
1 37.57 47.54 44.0
2 0 3.94 55.6
2 4.38 19.66 60.0
2 20.27 32.38 76.3
2 33.05 48.77 89.8
1 47.96 52.56 108.0
SEGS
ffmpeg -loglevel error -y -i "$1" -i narracion.mp3 -i narracion2.mp3 -filter_complex "${F}${M}amix=inputs=$i:normalize=0,apad[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest "$2"
