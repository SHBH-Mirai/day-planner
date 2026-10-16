// Pin every test run to IST so day-boundary tests don't depend on the machine.
export default function setup() {
  process.env.TZ = 'Asia/Kolkata'
}
