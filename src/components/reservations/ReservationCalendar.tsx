"use client";

import React, { useState } from 'react';
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRange } from 'react-day-picker';
import { addDays, format } from 'date-fns';
import { Label } from '../ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Button } from '../ui/button';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReservationCalendarProps {
  selectedDateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  bookedDates?: Date[]; // For disabling dates, can be expanded to include time slots
}

export default function ReservationCalendar({
  selectedDateRange,
  onDateRangeChange,
  bookedDates = [],
}: ReservationCalendarProps) {
  const [month, setMonth] = useState<Date>(selectedDateRange?.from || new Date());

  // Example of disabling past dates and specific booked dates
  const disabledDays = [
    ...bookedDates,
    { before: new Date() } // Disable all past dates
  ];
  
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-headline">Select Reservation Dates</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <div className="grid gap-2 w-full">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={"outline"}
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDateRange && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDateRange?.from ? (
                    selectedDateRange.to ? (
                      <>
                        {format(selectedDateRange.from, "LLL dd, y")} -{" "}
                        {format(selectedDateRange.to, "LLL dd, y")}
                      </>
                    ) : (
                      format(selectedDateRange.from, "LLL dd, y")
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={selectedDateRange?.from}
                  selected={selectedDateRange}
                  onSelect={onDateRangeChange}
                  numberOfMonths={2}
                  disabled={disabledDays}
                  month={month}
                  onMonthChange={setMonth}
                />
              </PopoverContent>
            </Popover>
          </div>

        {selectedDateRange?.from && (
          <p className="text-sm text-muted-foreground">
            Selected Start: {format(selectedDateRange.from, "PPP")}
          </p>
        )}
        {selectedDateRange?.to && (
          <p className="text-sm text-muted-foreground">
            Selected End: {format(selectedDateRange.to, "PPP")}
          </p>
        )}
        {!selectedDateRange?.to && selectedDateRange?.from && (
            <p className="text-sm text-primary">Please select an end date.</p>
        )}
      </CardContent>
    </Card>
  );
}
