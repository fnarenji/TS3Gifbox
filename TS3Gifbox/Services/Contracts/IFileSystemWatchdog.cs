using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TS3Gifbox.Entities;

namespace TS3Gifbox.Services.Contracts
{
    public interface IFileSystemWatchdog : IDisposable
    {
        /// <summary>
        /// Waits for filesystem to change
        /// </summary>
        /// <returns>A notification informing of the change</returns>
        Task<FileSystemNotificationModel> WaitForFileSystemChangeAsync();
    }
}
