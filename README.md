# homebridge-odor-sensor

Odor sensor accessory plugin for [Homebridge](https://github.com/homebridge/homebridge) using TGS2450

## Configuration

Example configuration:

```json
"accessories": [
   {
      "accessory": "OderSensor",
      "name": "Odor sensor",
      "options": {
         "spidev": "0.0",
         "pins": {
            "heater": 11,
            "sensor": 15
         },
         "threshold": {
            "poor": 500,
            "inferior": 450,
            "fair": 400,
            "good": 300,
            "excellent": 250
         }
      }
   }
]
```

## Thanks

https://fabcross.jp/category/make/sorepi/20171019_smell.html
