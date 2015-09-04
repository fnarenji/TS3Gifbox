using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using TS3Gifbox.Entities;

namespace TS3Gifbox.Services.Contracts
{
    public interface IFileSystemWatcherService
    {
        /// <summary>
        /// Sets up file system watch over a directory
        /// </summary>
        /// <param name="path">Path to watch</param>
        /// <returns>A notification informing of the change</returns>
         IFileSystemWatchdog SetupFileSystemWatch(string path);
    }
}
