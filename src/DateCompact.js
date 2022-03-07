// DateCompact.js - small date display with dialog to change
// Copyright © 2021 Doug Reeder

import PropTypes from 'prop-types';
import {Button, Dialog, DialogActions, DialogContent, Input} from "@mui/material";
import React, {useState} from "react";

const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function DateCompact({date, onChange}) {
  let dateStr;
  if (!date || ! date.valueOf()) {
    dateStr = "no date";
    date = new Date();
  }
  if (Date.now() - date > 11 * 30 * 24 * 60 * 60 * 1000) {
    dateStr = date.getFullYear();
  } else {
    dateStr = `${months[date.getMonth()]} ${date.getDate()}`;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [dateValue, setDateValue] = useState('');

  function handleDateClick(evt) {
    setIsOpen(true);
    const monthStr = ("0" + (date?.getMonth()+1)).slice(-2);
    const dayOfMonthStr = ("0" + date?.getDate()).slice(-2);
    setDateValue(`${date?.getFullYear()}-${monthStr}-${dayOfMonthStr}`);
  }

  return <>
    <Button variant="outlined" aria-haspopup="true" onClick={handleDateClick} sx={{m: "1.5ch", flexShrink: 1, cursor: 'pointer', color: 'black', borderColor: 'black'}} title="Change date">
      {dateStr}
    </Button>
    <Dialog
        id="date-dialog"
        open={isOpen}
        onClose={evt => setIsOpen(false)}
    >
      <DialogContent>
        <Input type="date" value={dateValue} onChange={evt => setDateValue(evt.target.value)}/>
      </DialogContent>
      <DialogActions>
        <Button onClick={evt => setIsOpen(false)}>Cancel</Button>
        <Button onClick={evt => {
          onChange({target: {value: dateValue}});
          setIsOpen(false);
        }}>Set</Button>
      </DialogActions>
    </Dialog>
  </>;
}

DateCompact.propTypes = {
  date: PropTypes.instanceOf(Date).isRequired,
  onChange: PropTypes.func.isRequired,
}

export default DateCompact;
