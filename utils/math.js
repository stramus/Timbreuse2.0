/**
 * Handle mathematics functions needed by the server.
 *
 * @module math
 * @class math
 */
module.exports = {
  /**
   * Compute the delta in seconds between two given time
   * @method getTimeDelta
   * @param {Date} date1 the start date.
   * @param {Date} date2 the end date.
   * @return {Integer} the difference in seconds between the date1 and the date2
   **/
  getTimeDelta: (date1, date2) => {
    return (Math.abs(date1 - date2) / 1000);
  },
  /**
   * Convert seconds to H:M:S format
   * @method secondsToHms
   **/
  secondsToHms: function(nb) {
    function addZero(nb)
    {
      if(Math.abs(nb<10))
      {
        return "0" + nb.toString();
      } else {
        return nb.toString();
      }
    }
    var neg;
    (nb < 0) ? neg = true: neg = false;
    nb = Math.abs(Number(nb));
    var h = Math.floor(nb / 3600);
    var m = Math.floor(Math.floor(nb % 3600) / 60);
    var s = Math.floor(nb % 60);
    return ((neg) ? "-":"+") + " " + addZero(h) + ":" + addZero(m) + ":" + addZero(s);
  }
};
