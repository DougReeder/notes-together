// NonmodalDialog — for Notes Together
// Copyright © 2024 Doug Reeder

import {Box, Button, Fade, Paper, Stack, Typography} from "@mui/material";
import PropTypes from "prop-types";
import {useCallback, useEffect, useRef} from "react";

export function NonmodalDialog({open, title, message, okName = "Ok", onOk, cancelName = "Cancel", onCancel}) {
  const okButtonRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    if (!open) { return; }
    if ('function' === typeof okButtonRef.current?.focus) {
      okButtonRef.current?.focus();
    } else {
      cancelButtonRef.current?.focus();
    }
  }, [open]);

  const dialogRef = useRef();

  const dialogKeyListener = useCallback(evt => {
    if (evt.isComposing || evt.keyCode === 229) {
      return;
    }
    switch (evt.code) {
      case 'Escape':
        console.log("Dialog escape:", evt.target)
        evt.stopPropagation();
        evt.target?.blur();
        onCancel();
        break;
    }
    return true;
  }, [onCancel]);

  useEffect(() => {
    const currentDialog = dialogRef.current;
    currentDialog?.addEventListener('keydown', dialogKeyListener);

    return function removeListListener(){
      currentDialog?.removeEventListener('keydown', dialogKeyListener);
    }
  }, [dialogKeyListener]);

  return <Fade appear={false} in={open}>
    <Paper ref={dialogRef} role="dialog" aria-modal="false" aria-labelledby="dialogTitle"
           aria-describedby="dialogMessage" variant="elevation" elevation={10} tabIndex={0}
           sx={{ position: 'absolute', bottom: '9ex', left: 0, right: 0, m: 0, p: 2, zIndex: 1}}
    >
      <Stack direction={{ xs: 'column' }} justifyContent="space-between" gap={2} >
        <Box sx={{ flexShrink: 1, alignSelf: { xs: 'flex-start', sm: 'center' }, }} >
          <Typography id="dialogTitle" variant="subtitle1" fontWeight="bold">{title}</Typography>
          <Typography id="dialogMessage" variant="body2">{message}</Typography>
        </Box>
        <Stack gap={2} direction={{ xs: 'row' }}
               sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'center' },}}>
          {onOk &&
          <Button size="small" onClick={onOk} variant="contained" ref={okButtonRef}>{okName}</Button>}
          <Button size="small" onClick={onCancel} ref={cancelButtonRef}>{cancelName}</Button>
        </Stack>
      </Stack>
    </Paper>
  </Fade>
}

NonmodalDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  message: PropTypes.string.isRequired,
  okName: PropTypes.string,
  onOk: PropTypes.func,
  cancelName: PropTypes.string,
  onCancel: PropTypes.func.isRequired,
}
