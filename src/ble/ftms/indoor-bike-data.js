import { parseFtmsIndoorBikeMeasurement } from '@deancochran/ftms';

// Preserve Auuki's field names and units at the application boundary.
// Round back to the wire's precision when converting normalized values.
const speedKph = value => Math.round(value * 360) * 0.01;
const rawTenths = value => Math.round(value * 10);
const fields = [
    ['speed', 'speedMps', speedKph],
    ['AverageSpeed', 'averageSpeedMps', speedKph],
    ['cadence', 'cadenceRpm'],
    ['AverageCadence', 'averageCadenceRpm'],
    ['distance', 'distanceMeters'],
    // Historically exposed as an unsigned, unscaled two-byte value.
    ['ResistanceLevel', 'resistanceLevel', value => rawTenths(value) & 0xffff],
    ['power', 'powerWatts'],
    ['AveragePower', 'averagePowerWatts'],
    ['TotalEnergy', 'energyKcal'],
    ['EnergyPerHour', 'energyPerHourKcal'],
    ['EnergyPerMinute', 'energyPerMinuteKcal'],
    ['heartRate', 'hrBpm'],
    ['MetabolicEquivalent', 'metabolicEquivalent', rawTenths],
    ['ElapsedTime', 'elapsedTimeSeconds'],
    ['RemainingTime', 'remainingTimeSeconds'],
];

function IndoorBikeData() {
    function decode(dataview) {
        // A notification can be a view into a larger buffer. Decode only its span.
        const bytes = new Uint8Array(
            dataview.buffer, dataview.byteOffset, dataview.byteLength,
        );
        const { metrics } = parseFtmsIndoorBikeMeasurement(bytes, {
            // Keep the two-byte resistance layout used by Auuki's existing parser.
            // Do not guess layouts from packet length or equipment identity.
            resistanceFormat: 'signed16Tenths',
        });

        return fields.reduce((data, [name, metric, convert]) => {
            const value = metrics[metric];
            // Absent, unavailable and incomplete values must not overwrite data
            // with null or be presented as fresh zero-valued measurements.
            if(value !== null) data[name] = convert ? convert(value) : value;
            return data;
        }, {});
    }

    return Object.freeze({ decode });
}

const indoorBikeData = IndoorBikeData();

export { IndoorBikeData, indoorBikeData };
