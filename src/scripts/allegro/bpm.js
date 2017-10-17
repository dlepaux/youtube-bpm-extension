const OfflineContext = (window.OfflineAudioContext || window.webkitOfflineAudioContext);

/**
 * [getPeaks description]
 * @param  {[type]}   buffer   [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function getPeaks(buffer, callback) {
  const source = getLowPassSource(buffer);

  /**
   * Schedule the sound to start playing at time:0
   */

  source.start(0);

  /**
   * Reference thresold value => peaks finded
   */

  let peaks = {};

  /**
   * Top starting value to check peaks
   */

  let thresold = 0.95;

  /**
   * Minimum value to check peaks
   */

  const minThresold = 0.30;

  console.log('source.buffer.getChannelData(0)', source.buffer.getChannelData(0));

  /**
   * Keep looking for peaks lowering the thresold
   */
  do {
    thresold = (thresold - 0.05).toFixed(2);
    peaks[thresold.toString()] = findPeaksAtThresold(source.buffer.getChannelData(0), thresold);
  } while (thresold > minThresold)

  /**
   * Resolve data
   */

  callback(peaks);
};


/**
 * Return in a callback the computed bpm from data
 * @param  {[type]}   data     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
function computeBPM (data, sampleRate, callback) {
  console.log('computeBPM');
  /**
   * Minimum peaks
   */
  const minPeaks = 15;

  /**
   * Flag to fix Object.keys looping
   */
  let peaksFound = false;

  /**
   * Top starting value to check peaks
   */

  let thresold = 0.95;

  /**
   * Minimum value to check peaks
   */

  const minThresold = 0.30;



  /**
   * Keep looking for peaks lowering the thresold
   */
  do {
    thresold = (thresold - 0.05).toFixed(2);

    if (data[thresold].length > minPeaks) {

      // Peaks serie found !
      console.log('Peaks serie found !');
      console.log('thresold', thresold);
      console.log('data', data);
      return callback(data);
      /*peaksFound = true;
      callback(null, [
        identifyIntervals,
        groupByTempo(sampleRate),
        getTopCandidates
      ].reduce(
       (state, fn) => fn(state),
        data[thresold]
      ));*/
    }
  } while (thresold > minThresold && ! peaksFound);

  if ( ! peaksFound) callback(new Error('Could not find enough samples for a reliable detection.'))
};






/**
 * Sort results by count and return top candidate
 * @param  {Object} Candidate
 * @return {Number}
 */

function getTopCandidates(candidates) {
  return candidates.sort((a, b) => (b.count - a.count)).splice(0, 5);
}

/**
 * Apply a low pass filter to an AudioBuffer
 * @param  {AudioBuffer}            buffer Source AudioBuffer
 * @return {AudioBufferSourceNode}
 */

function getLowPassSource(buffer) {
  const {length, numberOfChannels, sampleRate} = buffer;
  const context = new OfflineContext(numberOfChannels, length, sampleRate);

  /**
   * Create buffer source
   */

  const source = context.createBufferSource();
  source.buffer = buffer;

  /**
   * Create filter
   */

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';

  /**
   * Pipe the song into the filter, and the filter into the offline context
   */

  source.connect(filter);
  filter.connect(context.destination);

  return source;
}

/**
 * Find peaks in sampleRate
 * @param  {Array} data Bugger channel data
 * @return {Array}      Peaks found that are greater than the thresold
 */

function findPeaks(data) {
  let peaks = [];
  let thresold = 0.95;
  const minThresold = 0.30;
  const minPeaks = 15;

  /**
   * Keep looking for peaks lowering the thresold until
   * we have at least 15 peaks (10 seconds @ 90bpm)
   */
  do {
    thresold = (thresold - 0.05).toFixed(2);
    peaks = findPeaksAtThresold(data, thresold);
  } while (peaks.length < minPeaks && thresold > minThresold);

  /**
   * Too fiew samples are unreliable
   */

  if (peaks.length < minPeaks) {
    throw (
      new Error('Could not find enough samples for a reliable detection.')
    );
  }

  return peaks;
}

/**
 * Function to identify peaks
 * @param  {Array}  data      Buffer channel data
 * @param  {Number} thresold Thresold for qualifying as a peak
 * @return {Array}            Peaks found that are grater than the thresold
 */

function findPeaksAtThresold(data, thresold) {
  const peaks = [];

  /**
   * Identify peaks that pass the thresold, adding them to the collection
   */

  for (var i = 0, l = data.length; i < l; i += 1) {
    if (data[i] > thresold) {
      peaks.push(i);

      /**
       * Skip forward ~ 1/4s to get past this peak
       */

      i += 10000;
    }
  }

  return peaks;
}

/**
 * Identify intervals between peaks
 * @param  {Array} peaks Array of qualified peaks
 * @return {Array}       Identifies intervals between peaks
 */

function identifyIntervals(peaks) {
  const intervals = [];
  peaks.forEach((peak, index) => {
    for (let i = 0; i < 10; i+= 1) {
      let interval = peaks[index + i] - peak;

      /**
       * Try and find a matching interval and increase it's count
       */

      let foundInterval = intervals.some(intervalCount => {
        if (intervalCount.interval === interval) {
          return intervalCount.count += 1;
        }
      });
      //console.log('foundInterval');
      //console.log(foundInterval);
      /**
       * Add the interval to the collection if it's unique
       */

      if (!foundInterval) {
        intervals.push({
          interval: interval,
          count: 1
        });
      }
    }
  });
  return intervals;
}

/**
 * Factory for group reducer
 * @param  {Number} sampleRate Audio sample rate
 * @return {Function}
 */

function groupByTempo(sampleRate) {
  /**
   * Figure out best possible tempo candidates
   * @param  {Array} intervalCounts List of identified intervals
   * @return {Array}                Intervals grouped with similar values
   */

  return (intervalCounts) => {
    const tempoCounts = [];

    intervalCounts.forEach(intervalCount => {
      if (intervalCount.interval !== 0) {
        /**
         * Convert an interval to tempo
         */

        let theoreticalTempo = (60 / (intervalCount.interval / sampleRate));
        console.log(theoreticalTempo);
        /**
         * Adjust the tempo to fit within the 90-180 BPM range
         */

        while (theoreticalTempo < 90) theoreticalTempo *= 2;
        while (theoreticalTempo > 180) theoreticalTempo /= 2;

        /**
         * Round to legible integer
         */

        theoreticalTempo = Math.round(theoreticalTempo);

        /**
         * See if another interval resolved to the same tempo
         */

        let foundTempo = tempoCounts.some(tempoCount => {
          if (tempoCount.tempo === theoreticalTempo) {
            return tempoCount.count += intervalCount.count;
          }
        });

        /**
         * Add a unique tempo to the collection
         */

        if (!foundTempo) {
          tempoCounts.push({
            tempo: theoreticalTempo,
            count: intervalCount.count
          });
        }
      }
    });

    return tempoCounts;
  }
}

module.exports = {
  computeBPM: computeBPM,
  getPeaks: getPeaks
};