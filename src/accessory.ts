import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  CharacteristicEventTypes,
  CharacteristicGetCallback,
  HAP,
  Logging,
  Service
} from "homebridge";
import SPI from "pi-spi";
import gpio from "rpi-gpio";

let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("OderSensor", OderSensor);
};

class OderSensor implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;
  private initialized = false;
  private currentValue: number = 0;

  private readonly airQualitySensorService: Service;
  private readonly informationService: Service;

  private readonly DEVICE_FILE_PATH = '/dev/spidev0.0';
  private readonly dummy = 0xff;
  private readonly start = 0x47;
  private readonly sgl = 0x20;
  private readonly msbf = 0x08;

  private readonly spi: SPI.SPI;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;

    this.airQualitySensorService = new hap.Service.AirQualitySensor(this.name);
    this.airQualitySensorService.getCharacteristic(hap.Characteristic.AirQuality)
      .on(CharacteristicEventTypes.GET, (callback: CharacteristicGetCallback) => {
        log.info("Current state of the sensor was returned: " + this.currentValue);
        callback(undefined, this.currentValue);
      })

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Kawabata Farm")
      .setCharacteristic(hap.Characteristic.Model, "TGS2450");

    this.spi = SPI.initialize(this.DEVICE_FILE_PATH);
    this.spi.clockSpeed(1e6);

    const i = setInterval(async () => {
      if (!this.initialized) {
        this.initialized = true;
        await this.setupGpio(11, gpio.DIR_OUT);
        await this.setupGpio(15, gpio.DIR_OUT);
      }

      gpio.write(15, true);
      await this.sleep(3);
      this.currentValue = await this.measure();
      gpio.write(15, false);

      gpio.write(11, true);
      await this.sleep(8);
      gpio.write(11, false);
    }, 250)

    process.on('SIGINT', () => {
      clearInterval(i);
      this.spi.close(() => {});
    });
    process.on('beforeExit', () => {
      clearInterval(i);
      this.spi.close(() => {});
    });

    log.info("Irder sensor finished initializing!");
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log("Identify!");
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.airQualitySensorService,
    ];
  }

  measure(): Promise<number> {
    return new Promise((resolve) => {
      const buf = Buffer.alloc(2);
      buf[0] = this.start + this.sgl + this.msbf;
      buf[1] = this.dummy;
      this.spi.transfer(buf, buf.length, (err: any, data: Buffer) => {
        const val = 1023 - (((data[0] & 0x03) << 8) + data[1]);
        let result = hap.Characteristic.AirQuality.UNKNOWN;
        if (val > 500) {
          result = hap.Characteristic.AirQuality.POOR
        } else if (val > 450) {
          result = hap.Characteristic.AirQuality.INFERIOR
        } else if (val > 400) {
          result = hap.Characteristic.AirQuality.FAIR
        } else if (val > 350) {
          result = hap.Characteristic.AirQuality.GOOD
        } else if (val > 250) {
          result = hap.Characteristic.AirQuality.EXCELLENT
        }
        this.log(`sensor value: ${val}`);
        resolve(result);
      });
    });
  }

  setupGpio(pin: number, inout: any): Promise<any> {
    return new Promise((resolve) => {
      gpio.setup(pin, inout, () => {
        resolve();
      });
    });
  }

  sleep(timeout: number): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, timeout);
    });
  };

}
