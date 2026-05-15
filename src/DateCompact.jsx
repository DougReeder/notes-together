// DateCompact.js - small date display with dialog to change
// Copyright © 2021–2026 Doug Reeder

import PropTypes from 'prop-types';
import {Button, Input} from "@mui/material";
import {useState} from "react";

const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function DateCompact({date, onChange}) {
  let dateStr;
  if (!date || ! date.valueOf()) {
    dateStr = "no date";
    date = new Date();
  } else if (Math.abs(Date.now() - date) > 11 * 30 * 24 * 60 * 60 * 1000) {
    dateStr = date.getFullYear();
  } else {
    dateStr = `${months[date.getMonth()]} ${date.getDate()}`;
  }

  function handleButtonClick(_evt) {
    const input = document.querySelector('input[type="date"]');
    input?.showPicker?.();
    setOriginalDate(date);
  }

  const [originalDate, setOriginalDate] = useState(null);

  function handleDateChange(evt) {
    if (evt.target.value) {
      onChange(evt);
    } else if (! isNaN(originalDate?.getTime())) {   // Clear button was clicked
      onChange({target: {value: calcDateString(originalDate)}})
    }
  }

  return <>
    <Input type="date" value={calcDateString(date)} style={{position: 'fixed', top: '1.8ex', visibility: 'hidden'}} tabIndex={-1} onChange={handleDateChange}/>
    <Button variant="outlined" aria-haspopup="true" onClick={handleButtonClick} sx={{m: "1.5ch", flexShrink: 1, cursor: 'pointer', color: 'black', borderColor: 'black'}} title="Change date">
      {dateStr}
    </Button>
  </>;
}

function calcDateString(date) {
  const monthStr = ("0" + (date?.getMonth()+1)).slice(-2);
  const dayOfMonthStr = ("0" + date?.getDate()).slice(-2);
  return `${date?.getFullYear()}-${monthStr}-${dayOfMonthStr}`;
}

DateCompact.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
  onChange: PropTypes.func.isRequired,
}

export default DateCompact;
