using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Threading.Tasks.Dataflow;
using TS3Gifbox.Entities;
using TS3Gifbox.Services.Contracts;

namespace TS3Gifbox.Services
{
    class FileSystemWatchdog : IFileSystemWatchdog
    {
        private readonly FileSystemWatcher _fileSystemWatcher;
        private readonly BufferBlock<FileSystemNotificationModel> _notificationBuffer = new BufferBlock<FileSystemNotificationModel>();

        public FileSystemWatchdog(string path)
        {
            _fileSystemWatcher = new FileSystemWatcher(path);
            
            _fileSystemWatcher.EnableRaisingEvents = true;
            _fileSystemWatcher.Created += FileSystemChanged;
            _fileSystemWatcher.Changed += FileSystemChanged;
            _fileSystemWatcher.Deleted += FileSystemChanged;
        }

        private void FileSystemChanged(object sender, FileSystemEventArgs e)
        {
            _notificationBuffer.Post(new FileSystemNotificationModel
            {
                ChangeType = e.ChangeType,
                FilePath = e.FullPath
            });
        }

        public async Task<FileSystemNotificationModel> WaitForFileSystemChangeAsync()
        {
            await _notificationBuffer.OutputAvailableAsync();

            FileSystemNotificationModel notification = _notificationBuffer.Receive();

            return notification;
        }

        #region IDisposable Support
        private bool disposedValue = false; // To detect redundant calls

        protected virtual void Dispose(bool disposing)
        {
            if (!disposedValue)
            {
                if (disposing)
                {
                    _fileSystemWatcher.Dispose();
                }

                disposedValue = true;
            }
        }

        public void Dispose()
        {
            Dispose(true);
        }
        #endregion
    }
}
