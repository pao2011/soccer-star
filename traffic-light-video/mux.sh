#!/bin/sh
# Places each narration sentence (cut from narracion.mp3 at its pauses) at its scene's start time.
# usage: sh mux.sh video-sin-audio.mp4 salida.mp4
set -e
cd "$(dirname "$0")"
F=""; M=""; i=0
# start end delay (seconds) per sentence
while read a b d; do
  F="$F[1:a]atrim=$a:$b,asetpts=PTS-STARTPTS,adelay=$(echo "$d*1000/1" | bc):all=1[s$i];"; M="$M[s$i]"; i=$((i+1))
done <<SEGS
0 6.02 0.2
6.46 10.16 6.5
10.69 16.86 13.0
17.30 23.99 19.6
24.43 30.34 26.4
30.79 37.10 34.7
37.57 47.54 44.0
47.96 52.56 56.0
SEGS
ffmpeg -loglevel error -y -i "$1" -i narracion.mp3 -filter_complex "${F}${M}amix=inputs=$i:normalize=0,apad[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest "$2"
