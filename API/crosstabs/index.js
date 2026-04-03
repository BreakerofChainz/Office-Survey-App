
module.exports = async function (context, req) {
  // Example cross-tab: coffeePreference x meetingTime
  context.res = {
    status: 200,
    headers: { "content-type": "application/json" },
    body: {
      coffeePreference_meetingTime: {
        rows: ["Hot", "Iced", "Tea", "None"],
        cols: ["Early", "LateMorning", "Afternoon", "NoPreference"],
        values: [
          [2, 4, 3, 1],
          [1, 2, 3, 1],
          [1, 1, 1, 1],
          [1, 1, 0, 0]
        ]
      }
    }
  };
};
