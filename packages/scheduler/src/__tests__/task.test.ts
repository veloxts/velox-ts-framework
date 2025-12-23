/**
 * Task Builder Tests
 */

import { describe, expect, it } from 'vitest';

import { defineSchedule, task } from '../task.js';

describe('Task Builder', () => {
  describe('task()', () => {
    it('should create a task with name and handler', () => {
      const handler = () => {};
      const t = task('test-task', handler).everyMinute().build();

      expect(t.name).toBe('test-task');
      expect(t.handler).toBe(handler);
    });

    it('should set description', () => {
      const t = task('test', () => {})
        .description('Clean up expired tokens')
        .everyMinute()
        .build();

      expect(t.description).toBe('Clean up expired tokens');
    });
  });

  describe('Schedule Frequency', () => {
    it('should handle everyMinute()', () => {
      const t = task('test', () => {})
        .everyMinute()
        .build();
      expect(t.cronExpression).toBe('* * * * *');
    });

    it('should handle everyMinutes(5)', () => {
      const t = task('test', () => {})
        .everyMinutes(5)
        .build();
      expect(t.cronExpression).toBe('*/5 * * * *');
    });

    it('should handle everyFiveMinutes()', () => {
      const t = task('test', () => {})
        .everyFiveMinutes()
        .build();
      expect(t.cronExpression).toBe('*/5 * * * *');
    });

    it('should handle everyTenMinutes()', () => {
      const t = task('test', () => {})
        .everyTenMinutes()
        .build();
      expect(t.cronExpression).toBe('*/10 * * * *');
    });

    it('should handle everyFifteenMinutes()', () => {
      const t = task('test', () => {})
        .everyFifteenMinutes()
        .build();
      expect(t.cronExpression).toBe('*/15 * * * *');
    });

    it('should handle everyThirtyMinutes()', () => {
      const t = task('test', () => {})
        .everyThirtyMinutes()
        .build();
      expect(t.cronExpression).toBe('*/30 * * * *');
    });

    it('should handle hourly()', () => {
      const t = task('test', () => {})
        .hourly()
        .build();
      expect(t.cronExpression).toBe('0 * * * *');
    });

    it('should handle hourlyAt(15)', () => {
      const t = task('test', () => {})
        .hourlyAt(15)
        .build();
      expect(t.cronExpression).toBe('15 * * * *');
    });

    it('should handle everyHours(2)', () => {
      const t = task('test', () => {})
        .everyHours(2)
        .build();
      expect(t.cronExpression).toBe('0 */2 * * *');
    });

    it('should handle daily()', () => {
      const t = task('test', () => {})
        .daily()
        .build();
      expect(t.cronExpression).toBe('0 0 * * *');
    });

    it('should handle dailyAt("09:30")', () => {
      const t = task('test', () => {})
        .dailyAt('09:30')
        .build();
      expect(t.cronExpression).toBe('30 9 * * *');
    });

    it('should handle twiceDaily(8, 17)', () => {
      const t = task('test', () => {})
        .twiceDaily(8, 17)
        .build();
      expect(t.cronExpression).toBe('0 8,17 * * *');
    });

    it('should handle weekly()', () => {
      const t = task('test', () => {})
        .weekly()
        .build();
      expect(t.cronExpression).toBe('0 0 * * 0');
    });

    it('should handle weeklyOn("friday")', () => {
      const t = task('test', () => {})
        .weeklyOn('friday')
        .build();
      expect(t.cronExpression).toBe('0 0 * * 5');
    });

    it('should handle weeklyOn("friday", "14:30")', () => {
      const t = task('test', () => {})
        .weeklyOn('friday', '14:30')
        .build();
      expect(t.cronExpression).toBe('30 14 * * 5');
    });

    it('should handle weeklyOn(3) with numeric day', () => {
      const t = task('test', () => {})
        .weeklyOn(3)
        .build();
      expect(t.cronExpression).toBe('0 0 * * 3');
    });

    it('should handle monthly()', () => {
      const t = task('test', () => {})
        .monthly()
        .build();
      expect(t.cronExpression).toBe('0 0 1 * *');
    });

    it('should handle monthlyOn(15)', () => {
      const t = task('test', () => {})
        .monthlyOn(15)
        .build();
      expect(t.cronExpression).toBe('0 0 15 * *');
    });

    it('should handle monthlyOn(15, "10:00")', () => {
      const t = task('test', () => {})
        .monthlyOn(15, '10:00')
        .build();
      expect(t.cronExpression).toBe('0 10 15 * *');
    });

    it('should handle quarterly()', () => {
      const t = task('test', () => {})
        .quarterly()
        .build();
      expect(t.cronExpression).toBe('0 0 1 1,4,7,10 *');
    });

    it('should handle yearly()', () => {
      const t = task('test', () => {})
        .yearly()
        .build();
      expect(t.cronExpression).toBe('0 0 1 1 *');
    });

    it('should handle custom cron()', () => {
      const t = task('test', () => {})
        .cron('15 3 * * 1-5')
        .build();
      expect(t.cronExpression).toBe('15 3 * * 1-5');
    });

    it('should throw on invalid cron expression', () => {
      expect(() =>
        task('test', () => {})
          .cron('invalid')
          .build()
      ).toThrow('Invalid cron expression');
    });
  });

  describe('Time Methods', () => {
    it('should handle at("14:30")', () => {
      const t = task('test', () => {})
        .daily()
        .at('14:30')
        .build();
      expect(t.cronExpression).toBe('30 14 * * *');
    });

    it('should throw on invalid time format', () => {
      expect(() =>
        task('test', () => {})
          .at('25:00')
          .build()
      ).toThrow('Invalid hour');
    });

    it('should throw on invalid minute', () => {
      expect(() =>
        task('test', () => {})
          .at('12:60')
          .build()
      ).toThrow('Invalid minute');
    });
  });

  describe('Timezone', () => {
    it('should default to UTC', () => {
      const t = task('test', () => {})
        .everyMinute()
        .build();
      expect(t.timezone).toBe('UTC');
    });

    it('should set custom timezone', () => {
      const t = task('test', () => {})
        .everyMinute()
        .timezone('America/New_York')
        .build();
      expect(t.timezone).toBe('America/New_York');
    });
  });

  describe('Execution Control', () => {
    it('should set withoutOverlapping', () => {
      const t = task('test', () => {})
        .everyMinute()
        .withoutOverlapping()
        .build();
      expect(t.withoutOverlapping).toBe(true);
      expect(t.maxLockMinutes).toBeUndefined();
    });

    it('should set withoutOverlapping with maxLockMinutes', () => {
      const t = task('test', () => {})
        .everyMinute()
        .withoutOverlapping(30)
        .build();
      expect(t.withoutOverlapping).toBe(true);
      expect(t.maxLockMinutes).toBe(30);
    });

    it('should set timeout', () => {
      const t = task('test', () => {})
        .everyMinute()
        .timeout(5000)
        .build();
      expect(t.timeout).toBe(5000);
    });

    it('should throw on negative timeout', () => {
      expect(() =>
        task('test', () => {})
          .timeout(-1)
          .build()
      ).toThrow('Timeout must be a positive');
    });

    it('should add when constraint', () => {
      const t = task('test', () => {})
        .everyMinute()
        .when(() => true)
        .build();
      expect(t.constraints).toHaveLength(1);
    });

    it('should add skip constraint (inverted)', () => {
      const t = task('test', () => {})
        .everyMinute()
        .skip(() => false)
        .build();
      expect(t.constraints).toHaveLength(1);
    });

    it('should add environments constraint', () => {
      const t = task('test', () => {})
        .everyMinute()
        .environments(['production'])
        .build();
      expect(t.constraints).toHaveLength(1);
    });
  });

  describe('Day Constraints', () => {
    it('should add weekdays constraint', () => {
      const t = task('test', () => {})
        .daily()
        .weekdays()
        .build();
      expect(t.constraints.length).toBeGreaterThan(0);
    });

    it('should add weekends constraint', () => {
      const t = task('test', () => {})
        .daily()
        .weekends()
        .build();
      expect(t.constraints.length).toBeGreaterThan(0);
    });

    it('should add specific day constraints', () => {
      const t = task('test', () => {})
        .daily()
        .mondays()
        .build();
      expect(t.constraints.length).toBeGreaterThan(0);
    });

    it('should add custom days constraint', () => {
      const t = task('test', () => {})
        .daily()
        .days(['monday', 'wednesday', 'friday'])
        .build();
      expect(t.constraints.length).toBeGreaterThan(0);
    });
  });

  describe('Time Constraints', () => {
    it('should add between constraint', () => {
      const t = task('test', () => {})
        .everyMinute()
        .between('09:00', '17:00')
        .build();
      expect(t.constraints.length).toBeGreaterThan(0);
    });

    it('should add unlessBetween constraint', () => {
      const t = task('test', () => {})
        .everyMinute()
        .unlessBetween('00:00', '06:00')
        .build();
      expect(t.constraints.length).toBeGreaterThan(0);
    });
  });

  describe('Callbacks', () => {
    it('should set onSuccess callback', () => {
      const callback = () => {};
      const t = task('test', () => {})
        .everyMinute()
        .onSuccess(callback)
        .build();
      expect(t.onSuccess).toBe(callback);
    });

    it('should set onFailure callback', () => {
      const callback = () => {};
      const t = task('test', () => {})
        .everyMinute()
        .onFailure(callback)
        .build();
      expect(t.onFailure).toBe(callback);
    });

    it('should set onSkip callback', () => {
      const callback = () => {};
      const t = task('test', () => {})
        .everyMinute()
        .onSkip(callback)
        .build();
      expect(t.onSkip).toBe(callback);
    });
  });

  describe('Validation', () => {
    it('should throw on invalid minutes for everyMinutes()', () => {
      expect(() =>
        task('test', () => {})
          .everyMinutes(0)
          .build()
      ).toThrow('Minutes must be between 1 and 59');
      expect(() =>
        task('test', () => {})
          .everyMinutes(60)
          .build()
      ).toThrow('Minutes must be between 1 and 59');
    });

    it('should throw on invalid minute for hourlyAt()', () => {
      expect(() =>
        task('test', () => {})
          .hourlyAt(-1)
          .build()
      ).toThrow('Minute must be between 0 and 59');
      expect(() =>
        task('test', () => {})
          .hourlyAt(60)
          .build()
      ).toThrow('Minute must be between 0 and 59');
    });

    it('should throw on invalid hours for everyHours()', () => {
      expect(() =>
        task('test', () => {})
          .everyHours(0)
          .build()
      ).toThrow('Hours must be between 1 and 23');
      expect(() =>
        task('test', () => {})
          .everyHours(24)
          .build()
      ).toThrow('Hours must be between 1 and 23');
    });

    it('should throw on invalid hours for twiceDaily()', () => {
      expect(() =>
        task('test', () => {})
          .twiceDaily(-1, 12)
          .build()
      ).toThrow('Hours must be between 0 and 23');
      expect(() =>
        task('test', () => {})
          .twiceDaily(8, 24)
          .build()
      ).toThrow('Hours must be between 0 and 23');
    });

    it('should throw on invalid day for monthlyOn()', () => {
      expect(() =>
        task('test', () => {})
          .monthlyOn(0)
          .build()
      ).toThrow('Day must be between 1 and 31');
      expect(() =>
        task('test', () => {})
          .monthlyOn(32)
          .build()
      ).toThrow('Day must be between 1 and 31');
    });
  });
});

describe('defineSchedule()', () => {
  it('should return array of tasks', () => {
    const schedule = defineSchedule([
      task('task1', () => {})
        .daily()
        .build(),
      task('task2', () => {})
        .hourly()
        .build(),
    ]);

    expect(schedule).toHaveLength(2);
    expect(schedule[0].name).toBe('task1');
    expect(schedule[1].name).toBe('task2');
  });

  it('should throw on duplicate task names', () => {
    expect(() =>
      defineSchedule([
        task('duplicate', () => {})
          .daily()
          .build(),
        task('duplicate', () => {})
          .hourly()
          .build(),
      ])
    ).toThrow('Duplicate task name: "duplicate"');
  });
});
