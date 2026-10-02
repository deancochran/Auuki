import { IndoorBikeData, indoorBikeData } from '../../src/ble/ftms/indoor-bike-data.js';



describe('Indoor Bike Data', () => {
    const viewOf = bytes => new DataView(Uint8Array.from(bytes).buffer);

    test('preserves all existing field names, units and the two-byte resistance layout', () => {
        const view = viewOf([
            0xfe, 0x1f, // all optional fields, speed present
            0xca, 0x0c, // speed 32.74 km/h
            0x18, 0x0b, // average speed 28.40 km/h
            0xb5, 0x00, // cadence 90.5 rpm
            0xab, 0x00, // average cadence 85.5 rpm
            0xd3, 0xa4, 0x01, // distance, including a nonzero high byte
            0x7b, 0x00, // resistance: retain Auuki's unscaled value 123
            0xfa, 0x00, // power
            0xf0, 0x00, // average power
            0x2c, 0x01, 0x90, 0x01, 0x05, // energy
            0x91, // heart rate
            0x55, // metabolic equivalent: retain raw tenths
            0x58, 0x02, // elapsed time
            0x64, 0x00, // remaining time
        ]);
        expect(indoorBikeData.decode(view)).toEqual({
            speed: 3274 * 0.01, AverageSpeed: 2840 * 0.01,
            cadence: 90.5, AverageCadence: 85.5,
            distance: 107731, ResistanceLevel: 123,
            power: 250, AveragePower: 240,
            TotalEnergy: 300, EnergyPerHour: 400, EnergyPerMinute: 5,
            heartRate: 145, MetabolicEquivalent: 85,
            ElapsedTime: 600, RemainingTime: 100,
        });
    });

    test('decodes only the DataView span, not its prefix or backing-buffer tail', () => {
        const bytes = Uint8Array.of(0xff, 0xff, 0x44, 0, 0x10, 0x0e, 0xb4, 0, 0xfa, 0, 0xee);
        expect(indoorBikeData.decode(new DataView(bytes.buffer, 2, 8))).toEqual({
            speed: 36, cadence: 90, power: 250,
        });
        expect(indoorBikeData.decode(new DataView(bytes.buffer, 2, 7))).toEqual({
            speed: 36, cadence: 90,
        });
    });

    test('omits speed when More Data is set', () => {
        expect(indoorBikeData.decode(viewOf([0x45, 0, 0xb4, 0, 0xfa, 0]))).toEqual({
            cadence: 90, power: 250,
        });
    });

    test('decodes signed power rather than wrapping negative watts', () => {
        expect(indoorBikeData.decode(viewOf([0xc1, 0, 0xce, 0xff, 0x9c, 0xff]))).toEqual({
            power: -50, AveragePower: -100,
        });
    });

    test('preserves the legacy unsigned resistance output without shifting later fields', () => {
        expect(indoorBikeData.decode(viewOf([0x61, 0, 0xff, 0xff, 0xfa, 0]))).toEqual({
            ResistanceLevel: 65535, power: 250,
        });
    });

    test('keeps zero readings but omits absent fields', () => {
        expect(indoorBikeData.decode(viewOf([0x44, 0, 0, 0, 0, 0, 0, 0]))).toEqual({
            speed: 0, cadence: 0, power: 0,
        });
    });

    test('decodes unsigned energy values above the signed 16-bit range', () => {
        expect(indoorBikeData.decode(viewOf([1, 1, 0x40, 0x9c, 0x50, 0xc3, 254]))).toEqual({
            TotalEnergy: 40000, EnergyPerHour: 50000, EnergyPerMinute: 254,
        });
    });

    test('omits unavailable energy sentinels while retaining subsequent measurements', () => {
        expect(indoorBikeData.decode(viewOf([1, 3, 255, 255, 255, 255, 255, 145]))).toEqual({
            heartRate: 145,
        });
    });

    test('does not reinterpret a truncated power byte as a later heart-rate field', () => {
        expect(indoorBikeData.decode(viewOf([0x41, 2, 0xfa]))).toEqual({});
    });

    test.each([[], [0x44], [0x44, 0], [0x44, 0, 0x10]].map(bytes => [bytes]))(
        'handles incomplete flags or speed: %j', bytes => {
            expect(indoorBikeData.decode(viewOf(bytes))).toEqual({});
        },
    );

    test('retains the factory decode entry point', () => {
        expect(IndoorBikeData().decode(viewOf([0, 0, 0x10, 0x0e]))).toEqual({ speed: 36 });
    });

    test('speed-cadence-power', () => {
        const view = new DataView(
            new Uint8Array([
                 68,  0, // flags, 0b1000100
                202, 12, // instantaneous speed
                160,  0, // instantaneous cadence
                 44,  1, // power
            ]).buffer
        );

        const expected = {
            speed: 32.74,
            cadence: 80,
            power: 300,
        };

        const res = indoorBikeData.decode(view);
        expect(res).toEqual(expected);
    });

    test('speed-cadence-power-heartRate', () => {
        const view = new DataView(
            new Uint8Array([
                 68,  2, // flags, 0b1001000100
                202, 12, // instantaneous speed
                160,  0, // instantaneous cadence
                 44,  1, // power
                143,     // heart rate
            ]).buffer
        );

        const expected = {
            speed: 32.74,
            cadence: 80,
            power: 300,
            heartRate: 143,
        };

        const res = indoorBikeData.decode(view);
        expect(res).toEqual(expected);
    });

    test('speed-cadence-distance-power-heartRate', () => {
        // ['0x54', '0x02', '0xCA', '0x0C', '0xA0', '0x00', '0xD3', '0xA4', '0x00', '0x2C', '0x01', '0x8F']
        // '0x 54 02 CA 0C A0 00 D3 A4 00 2C 01 8F'

        const view = new DataView(
            new Uint8Array([
                84, 2,       // flags, 0b1001010100
                202, 12,     // instantaneous speed
                160, 0,      // instantaneous cadence
                211, 164, 0, // total distance
                44, 1,       // power
                143,         // heart rate
            ]).buffer
        );

        const expected = {
            speed:   32.74,
            cadence: 80,
            distance: 42195,
            power:   300,
            heartRate: 143,
        };

        const res = indoorBikeData.decode(view);

        expect(res).toEqual(expected);
    });
});
