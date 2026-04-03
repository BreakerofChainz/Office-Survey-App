
module.exports = async function (context, req) {
  // Stubbed data so the dashboard can render immediately
  context.res = {
    status: 200,
    headers: { "content-type": "application/json" },
    body: {
      coffeePreference: { Hot: 10, Iced: 7, Tea: 4, None: 2 },
      meetingTime: { Early: 5, LateMorning: 8, Afternoon: 6, NoPreference: 4 },
      leastFavoriteDay: { Monday: 9, Tuesday: 3, Thursday: 4, Friday: 2 },
      workStyle: { Alone: 7, SmallGroups:
