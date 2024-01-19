// NonmodalDialog — for Notes Together
// Copyright © 2024 Doug Reeder


import {Box, Button, Fade, Paper, Stack, Typography} from "@mui/material";
import PropTypes from "prop-types";

export function NonmodalDialog({open, title, message, okName = "OK", onOk, cancelName = "Cancel", onCancel}) {
  return <Fade appear={false} in={open}>
    <Paper role="dialog" aria-modal="false" /*aria-label="shareViaEmail"*/ square variant="outlined" tabIndex={-1}
      sx={{ position: 'absolute', bottom: '9ex', left: 0, right: 0, m: 0, p: 2, borderWidth: 4, zIndex: 1}}
    >
      <Stack direction={{ xs: 'column' }} justifyContent="space-between" gap={2} >
        <Box sx={{ flexShrink: 1, alignSelf: { xs: 'flex-start', sm: 'center' }, }} >
          <Typography fontWeight="bold">{title}</Typography>
          <Typography variant="body2">{message}</Typography>
        </Box>
        <Stack gap={2} direction={{ xs: 'row' }}
               sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'center' },}}>
          {onOk &&
          <Button size="small" onClick={onOk} variant="contained">{okName}</Button>}
          <Button size="small" onClick={onCancel}>{cancelName}</Button>
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
