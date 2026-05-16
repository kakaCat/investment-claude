# CRON Automation Setup

This document explains how to configure and use automated scheduled tasks for the investment-claude system.

## Overview

The CRON automation system allows you to schedule recurring tasks like evolution analysis, portfolio reviews, and other investment operations. Configuration is stored in `.pi/CRON.json`.

## CRON Schedule Format

CRON expressions use 5 fields to define when tasks run:

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday=0)
│ │ │ │ │
* * * * *
```

### Field Syntax

- `*` - Any value (wildcard)
- `N` - Specific value (e.g., `5`)
- `N-M` - Range (e.g., `1-5` for Monday-Friday)
- `N,M,O` - List (e.g., `1,3,5`)
- `*/N` - Step values (e.g., `*/15` for every 15 minutes)

### Common Schedule Examples

| Schedule | Description | Human Readable |
|----------|-------------|----------------|
| `0 9 * * 1` | Every Monday at 9:00 AM | Weekly on Monday morning |
| `0 10 1 * *` | 1st of month at 10:00 AM | Monthly on the 1st |
| `0 9 * * 1-5` | Weekdays at 9:00 AM | Every business day |
| `0 */6 * * *` | Every 6 hours | Four times daily |
| `30 14 * * 5` | Every Friday at 2:30 PM | Weekly Friday afternoon |
| `0 0 * * 0` | Every Sunday at midnight | Weekly Sunday night |
| `0 8,12,18 * * *` | 8 AM, 12 PM, 6 PM daily | Three times daily |

## Configuration File Structure

The `.pi/CRON.json` file contains an array of job definitions:

```json
{
  "jobs": [
    {
      "id": "unique-job-id",
      "name": "Human Readable Name",
      "schedule": "0 9 * * 1",
      "command": "evolution_run",
      "args": {
        "period_days": 7,
        "target_return": 20,
        "auto_apply": false
      },
      "enabled": true,
      "description": "Detailed description of what this job does"
    }
  ]
}
```

### Field Descriptions

- **id**: Unique identifier for the job (alphanumeric, hyphens, underscores)
- **name**: Human-readable name displayed in logs
- **schedule**: CRON expression (5 fields)
- **command**: Command to execute (see Available Commands below)
- **args**: Command-specific arguments (object)
- **enabled**: Whether the job is active (true/false)
- **description**: Detailed explanation of the job's purpose

## Available Commands

### evolution_run

Runs evolution analysis to compare actual performance against target and generate improvement recommendations.

**Arguments:**
- `period_days` (number): Analysis period in days (default: 30)
- `target_return` (number): Target return percentage (default: 20)
- `auto_apply` (boolean): Auto-apply recommendations (default: false)

**Example:**
```json
{
  "command": "evolution_run",
  "args": {
    "period_days": 7,
    "target_return": 20,
    "auto_apply": false
  }
}
```

**Safety Note:** Always set `auto_apply: false` for automated jobs. Review recommendations manually before applying changes.

## Managing Jobs

### Adding a New Job

1. Open `.pi/CRON.json`
2. Add a new job object to the `jobs` array
3. Ensure the `id` is unique
4. Set appropriate schedule and command
5. Save the file

Example:
```json
{
  "id": "daily-portfolio-check",
  "name": "Daily Portfolio Health Check",
  "schedule": "0 8 * * 1-5",
  "command": "evolution_run",
  "args": {
    "period_days": 1,
    "target_return": 20,
    "auto_apply": false
  },
  "enabled": true,
  "description": "Check portfolio health every weekday morning"
}
```

### Modifying a Job

1. Open `.pi/CRON.json`
2. Find the job by `id`
3. Update the desired fields (schedule, args, etc.)
4. Save the file
5. Changes take effect on next scheduler check (within 1 second)

### Enabling/Disabling Jobs

To temporarily disable a job without deleting it:

```json
{
  "id": "weekly-evolution",
  "enabled": false,
  ...
}
```

To re-enable:
```json
{
  "id": "weekly-evolution",
  "enabled": true,
  ...
}
```

### Removing a Job

1. Open `.pi/CRON.json`
2. Remove the entire job object from the `jobs` array
3. Save the file

## Viewing CRON Logs

Execution logs are stored in `.pi/cron-logs/`:

```bash
# View recent logs
ls -lt .pi/cron-logs/ | head -10

# View specific job logs
cat .pi/cron-logs/weekly-evolution-2026-05-16.log

# Monitor logs in real-time
tail -f .pi/cron-logs/latest.log
```

Log files are named: `{job-id}-{date}.log`

## Testing Jobs

### Test Without Waiting

To test a job without waiting for its scheduled time:

1. **Manual Execution via Tool:**
   ```typescript
   // In the application
   await runEvolutionTool({
     period_days: 7,
     target_return: 20,
     auto_apply: false
   })
   ```

2. **Temporary Schedule:**
   Set a schedule 1-2 minutes in the future:
   ```json
   {
     "schedule": "15 14 * * *",  // If current time is 14:13
     "enabled": true
   }
   ```
   Watch logs to verify execution, then restore original schedule.

3. **Validate Schedule Syntax:**
   Use the built-in CRON parser to verify your expression:
   ```typescript
   import { parseCronExpression, cronToHuman } from './src/cron/cron.js'

   const fields = parseCronExpression("0 9 * * 1")
   console.log(cronToHuman("0 9 * * 1"))  // "Every Monday at 9:00 AM"
   ```

### Verify Configuration

Check that your CRON.json is valid:

```bash
# Validate JSON syntax
cat .pi/CRON.json | jq .

# Check for duplicate IDs
cat .pi/CRON.json | jq '.jobs[].id' | sort | uniq -d
```

## Best Practices

### 1. Start Conservative

Begin with infrequent schedules (weekly/monthly) and adjust based on needs:
- ✅ Weekly analysis: `0 9 * * 1`
- ✅ Monthly review: `0 10 1 * *`
- ⚠️ Hourly checks: `0 * * * *` (may be excessive)

### 2. Safety First

- **Never** set `auto_apply: true` for automated jobs
- Always review recommendations manually
- Use longer analysis periods for automated jobs (7+ days)
- Test new jobs with `enabled: false` first

### 3. Avoid Peak Hours

Schedule resource-intensive jobs during off-peak times:
- ✅ Early morning: `0 6 * * *`
- ✅ Late evening: `0 22 * * *`
- ⚠️ Market hours: `0 9-16 * * 1-5` (may interfere with trading)

### 4. Stagger Jobs

If multiple jobs run similar operations, stagger their schedules:
```json
[
  { "schedule": "0 9 * * 1" },   // Monday 9 AM
  { "schedule": "0 10 1 * *" },  // 1st of month 10 AM
  { "schedule": "0 14 * * 5" }   // Friday 2 PM
]
```

### 5. Monitor Execution

- Check logs regularly: `.pi/cron-logs/`
- Set up alerts for failed jobs
- Review execution times to avoid overlaps

### 6. Document Custom Jobs

Add clear descriptions to help future maintainers:
```json
{
  "description": "Weekly evolution analysis focusing on short-term performance. Runs Monday morning before market open to review previous week's trades."
}
```

## Troubleshooting

### Job Not Running

1. **Check if enabled:**
   ```bash
   cat .pi/CRON.json | jq '.jobs[] | select(.id=="weekly-evolution") | .enabled'
   ```

2. **Verify schedule syntax:**
   ```bash
   # Should return valid fields, not null
   node -e "import('./src/cron/cron.js').then(m => console.log(m.parseCronExpression('0 9 * * 1')))"
   ```

3. **Check next run time:**
   ```bash
   # Should show future timestamp
   node -e "import('./src/cron/cron.js').then(m => console.log(m.nextCronRunMs('0 9 * * 1', Date.now())))"
   ```

4. **Review logs:**
   ```bash
   tail -50 .pi/cron-logs/latest.log
   ```

### Job Runs But Fails

1. **Check error logs:**
   ```bash
   grep -i error .pi/cron-logs/*.log
   ```

2. **Verify command arguments:**
   Ensure args match the command's expected schema

3. **Test manually:**
   Run the command directly to see detailed error messages

### Schedule Confusion

Use the human-readable converter:
```typescript
import { cronToHuman } from './src/cron/cron.js'
console.log(cronToHuman("0 9 * * 1"))  // "Every Monday at 9:00 AM"
```

### Timezone Issues

All times are in **local system timezone**. To check:
```bash
date
# Fri May 16 14:30:00 CST 2026
```

If you need UTC scheduling, convert manually:
- Local 9 AM CST = 3 PM UTC
- Schedule: `0 15 * * 1` (for 9 AM CST)

## Advanced Configuration

### Recurring Task Lifecycle

- **Recurring tasks** (`recurring: true`): Run indefinitely until disabled
- **One-shot tasks** (`recurring: false`): Run once then auto-delete
- **Max age**: Recurring tasks auto-delete after 7 days

### Custom Commands

To add new commands:

1. Create a tool in `src/tools/`
2. Export the execute function
3. Add command mapping in CRON scheduler
4. Update this documentation

### Integration with Existing Systems

The CRON system integrates with:
- **EvolutionRunTool**: Automated performance analysis
- **Decision Log**: Records all automated decisions
- **Evolution Reports**: Stores analysis results in `.pi/evolution/reports/`

## Example Configurations

### Conservative Setup (Recommended)

```json
{
  "jobs": [
    {
      "id": "weekly-evolution",
      "name": "Weekly Evolution Analysis",
      "schedule": "0 9 * * 1",
      "command": "evolution_run",
      "args": {
        "period_days": 7,
        "target_return": 20,
        "auto_apply": false
      },
      "enabled": true,
      "description": "Weekly performance review every Monday morning"
    }
  ]
}
```

### Active Monitoring Setup

```json
{
  "jobs": [
    {
      "id": "weekly-evolution",
      "name": "Weekly Evolution Analysis",
      "schedule": "0 9 * * 1",
      "command": "evolution_run",
      "args": {
        "period_days": 7,
        "target_return": 20,
        "auto_apply": false
      },
      "enabled": true,
      "description": "Weekly short-term performance analysis"
    },
    {
      "id": "monthly-evolution",
      "name": "Monthly Evolution Analysis",
      "schedule": "0 10 1 * *",
      "command": "evolution_run",
      "args": {
        "period_days": 30,
        "target_return": 20,
        "auto_apply": false
      },
      "enabled": true,
      "description": "Comprehensive monthly performance review"
    },
    {
      "id": "friday-review",
      "name": "End of Week Review",
      "schedule": "0 17 * * 5",
      "command": "evolution_run",
      "args": {
        "period_days": 5,
        "target_return": 20,
        "auto_apply": false
      },
      "enabled": true,
      "description": "Friday evening review of the trading week"
    }
  ]
}
```

## Support

For issues or questions:
1. Check logs in `.pi/cron-logs/`
2. Verify configuration with `jq`
3. Test manually before scheduling
4. Review this documentation

## Related Documentation

- [Evolution Service](../QUANT-AGENT-GUIDE.md)
- [Decision Log](.pi/decision-log.md)
- [Project Plan](../PROJECT_PLAN.md)
