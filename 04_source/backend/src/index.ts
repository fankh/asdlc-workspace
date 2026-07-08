import app from './app.js'
import { startScheduler } from './services/scheduler.js'
const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  startScheduler()
})
